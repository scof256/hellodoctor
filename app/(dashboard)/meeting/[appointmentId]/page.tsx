'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { ArrowLeft, AlertCircle, Loader2, Mic, MicOff, Video, VideoOff, Monitor, Phone, PhoneOff, Users, RefreshCw, MessageCircle, ExternalLink } from 'lucide-react';
import { 
  StreamCall, 
  StreamVideo, 
  StreamVideoClient,
  CallControls,
  SpeakerLayout,
  CallParticipantsList,
  useCallStateHooks,
  ParticipantView,
  useCall,
  CallingState,
} from '@stream-io/video-react-sdk';
import { useStreamVideoClient, type StreamVideoError, type FallbackOption, VIDEO_QUALITY_PRESETS } from '@/app/components/StreamVideoProvider';
import { generateStreamToken } from '@/server/actions/stream';

interface MeetingState {
  call: any | null;
  isJoining: boolean;
  error: StreamVideoError | null;
  participants: any[];
  accessValidated: boolean;
  userRole: 'doctor' | 'patient' | 'admin' | null;
  retryCount: number;
}

interface MeetingRoomProps {
  userRole: 'doctor' | 'patient' | 'admin' | null;
  onMeetingEnd: () => void;
  appointmentId: string;
}

// ============================================================================
// ERROR DISPLAY COMPONENT
// ============================================================================

interface ErrorDisplayProps {
  error: StreamVideoError;
  onRetry?: () => void;
  isRetrying?: boolean;
  userRole?: 'doctor' | 'patient' | 'admin' | null;
}

function ErrorDisplay({ error, onRetry, isRetrying, userRole }: ErrorDisplayProps) {
  const router = useRouter();

  const handleFallbackAction = (option: FallbackOption) => {
    switch (option.action) {
      case 'retry':
        onRetry?.();
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'contact':
        if (option.href) {
          router.push(option.href);
        }
        break;
    }
  };

  const getBackLink = () => {
    if (userRole === 'doctor') return '/doctor/appointments';
    if (userRole === 'admin') return '/admin';
    return '/patient/appointments';
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Unable to Join Meeting
            </h3>
            <p className="text-red-700 mb-4">
              {error.message}
            </p>
            
            {/* Fallback Options */}
            {error.fallbackOptions.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-sm text-red-600 font-medium">What you can do:</p>
                <div className="flex flex-wrap gap-2">
                  {error.fallbackOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleFallbackAction(option)}
                      disabled={isRetrying && option.action === 'retry'}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        option.action === 'retry'
                          ? 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50'
                          : option.action === 'refresh'
                          ? 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {option.action === 'retry' && (
                        isRetrying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )
                      )}
                      {option.action === 'refresh' && <RefreshCw className="w-4 h-4" />}
                      {option.action === 'contact' && <MessageCircle className="w-4 h-4" />}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Contact Information */}
            <div className="bg-white rounded-lg p-4 border border-red-100">
              <p className="text-sm text-slate-600 mb-2">
                If you need immediate assistance, you can:
              </p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-slate-400" />
                  <Link href="/support" className="text-blue-600 hover:underline">
                    Contact our support team
                  </Link>
                </li>
                <li className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <Link href={getBackLink()} className="text-blue-600 hover:underline">
                    Return to your appointments
                  </Link>
                </li>
              </ul>
            </div>

            {/* Error Code for Support */}
            <p className="text-xs text-red-400 mt-4">
              Error code: {error.code}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeetingRoom({ userRole, onMeetingEnd, appointmentId }: MeetingRoomProps) {
  const call = useCall();
  const { useCallCallingState, useParticipants, useLocalParticipant } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const router = useRouter();
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isEndingForAll, setIsEndingForAll] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const hasHandledAutoEnd = useRef(false);
  const previousParticipantCount = useRef(participants.length);

  // Check if user can end meeting for all (doctors and admins only)
  const canEndForAll = userRole === 'doctor' || userRole === 'admin';

  // End meeting mutation for doctors
  const endMeetingMutation = api.meeting.endMeetingForAll.useMutation({
    onSuccess: () => {
      onMeetingEnd();
    },
    onError: (error) => {
      console.error('Failed to end meeting for all:', error);
      // Still leave the call locally even if server-side end fails
      call?.leave().catch(console.error);
      onMeetingEnd();
    },
  });

  const toggleMic = useCallback(async () => {
    if (!call) return;
    try {
      if (isMicOn) {
        await call.microphone.disable();
      } else {
        await call.microphone.enable();
      }
      setIsMicOn(!isMicOn);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  }, [call, isMicOn]);

  const toggleCamera = useCallback(async () => {
    if (!call) return;
    try {
      if (isCameraOn) {
        await call.camera.disable();
      } else {
        await call.camera.enable();
      }
      setIsCameraOn(!isCameraOn);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  }, [call, isCameraOn]);

  const toggleScreenShare = useCallback(async () => {
    if (!call) return;
    try {
      if (isScreenSharing) {
        await call.screenShare.disable();
      } else {
        await call.screenShare.enable();
      }
      setIsScreenSharing(!isScreenSharing);
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  }, [call, isScreenSharing]);

  // Leave call (for individual participant)
  const leaveCall = useCallback(async () => {
    if (!call) return;
    try {
      await call.leave();
      onMeetingEnd();
    } catch (error) {
      console.error('Failed to leave call:', error);
      onMeetingEnd();
    }
  }, [call, onMeetingEnd]);

  // End call for all participants (doctors/admins only)
  const endCallForAll = useCallback(async () => {
    if (!call || !canEndForAll) return;
    
    setIsEndingForAll(true);
    try {
      // End the call on Stream's side
      await call.endCall();
      
      // Also update the server-side state
      endMeetingMutation.mutate({ appointmentId });
    } catch (error) {
      console.error('Failed to end call for all:', error);
      setIsEndingForAll(false);
      // Fallback: just leave the call
      await leaveCall();
    }
  }, [call, canEndForAll, appointmentId, endMeetingMutation, leaveCall]);

  // Handle participant disconnections gracefully
  useEffect(() => {
    if (!call) return;

    const handleParticipantLeft = (event: any) => {
      console.log('Participant left:', event);
      // The meeting continues even when participants disconnect
      // This is handled gracefully by Stream SDK
    };

    const handleCallEnded = () => {
      console.log('Call ended by host');
      onMeetingEnd();
    };

    // Subscribe to call events
    call.on('call.ended', handleCallEnded);
    
    return () => {
      call.off('call.ended', handleCallEnded);
    };
  }, [call, onMeetingEnd]);

  // Auto-end meeting when last participant leaves
  // Only triggers when going from >0 participants to 0 (excluding initial state)
  useEffect(() => {
    // Track participant count changes
    const currentCount = participants.length;
    const prevCount = previousParticipantCount.current;
    
    // Update the ref for next comparison
    previousParticipantCount.current = currentCount;
    
    // Only auto-end if:
    // 1. We had participants before (prevCount > 0)
    // 2. Now we have no participants (currentCount === 0)
    // 3. We haven't already handled this
    // 4. The call exists and is in a valid state
    if (
      prevCount > 0 && 
      currentCount === 0 && 
      !hasHandledAutoEnd.current && 
      call && 
      callingState === CallingState.JOINED
    ) {
      hasHandledAutoEnd.current = true;
      console.log('Last participant left, auto-ending meeting');
      
      // Give a small delay to ensure this isn't a temporary state
      const timeoutId = setTimeout(() => {
        if (participants.length === 0) {
          onMeetingEnd();
        } else {
          // Reset if participants came back
          hasHandledAutoEnd.current = false;
        }
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [participants.length, call, callingState, onMeetingEnd]);

  if (callingState === CallingState.JOINING) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Joining meeting…
        </div>
      </div>
    );
  }

  if (callingState === CallingState.LEFT) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-600">You have left the meeting</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* End Meeting Confirmation Modal */}
      {showEndConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">End Meeting for All?</h3>
            <p className="text-slate-600 mb-4">
              This will end the meeting for all participants. Are you sure you want to continue?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEndConfirmation(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                disabled={isEndingForAll}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirmation(false);
                  endCallForAll();
                }}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-500 rounded-lg flex items-center gap-2"
                disabled={isEndingForAll}
              >
                {isEndingForAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ending...
                  </>
                ) : (
                  'End for All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Layout */}
      <div className="flex-1 relative">
        {participants.length > 1 ? (
          <SpeakerLayout />
        ) : (
          <div className="flex items-center justify-center h-full">
            {localParticipant && (
              <ParticipantView participant={localParticipant} />
            )}
          </div>
        )}
      </div>

      {/* Participants List */}
      {participants.length > 0 && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-lg p-2">
          <div className="text-white text-sm mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Participants ({participants.length})
          </div>
          <div className="space-y-1">
            {participants.map((participant) => (
              <div key={participant.sessionId} className="flex items-center gap-2 text-white text-xs">
                <div className={`w-2 h-2 rounded-full ${participant.isLocalParticipant ? 'bg-green-400' : 'bg-blue-400'}`} />
                <span>{participant.name || participant.userId}</span>
                {participant.isLocalParticipant && userRole && (
                  <span className="text-xs text-slate-400">({userRole})</span>
                )}
                {!participant.audioStream && (
                  <MicOff className="w-3 h-3 text-red-400" />
                )}
                {!participant.videoStream && (
                  <VideoOff className="w-3 h-3 text-red-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Call Controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-black bg-opacity-50">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full ${
            isMicOn 
              ? 'bg-slate-700 hover:bg-slate-600 text-white' 
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full ${
            isCameraOn 
              ? 'bg-slate-700 hover:bg-slate-600 text-white' 
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full ${
            isScreenSharing 
              ? 'bg-blue-600 hover:bg-blue-500 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-white'
          }`}
          title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Leave Call Button (for all users) */}
        <button
          onClick={leaveCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white"
          title="Leave call"
        >
          <Phone className="w-5 h-5" />
        </button>

        {/* End Call for All Button (doctors/admins only) */}
        {canEndForAll && (
          <button
            onClick={() => setShowEndConfirmation(true)}
            className="p-3 rounded-full bg-red-800 hover:bg-red-700 text-white"
            title="End call for all participants"
            disabled={isEndingForAll}
          >
            {isEndingForAll ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PhoneOff className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MeetingPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = (params?.appointmentId as string) ?? '';

  const { client: streamClient, isLoading: isClientLoading, error: clientError, retry: retryClient, isRetrying: isClientRetrying, cleanupResources, videoQualityPreset } = useStreamVideoClient();
  const [meetingState, setMeetingState] = useState<MeetingState>({
    call: null,
    isJoining: false,
    error: null,
    participants: [],
    accessValidated: false,
    userRole: null,
    retryCount: 0,
  });

  // Validate meeting access using TRPC
  const { data: accessData, isLoading: isAccessLoading, error: accessError } = api.meeting.validateAccess.useQuery(
    { appointmentId },
    { 
      enabled: !!appointmentId,
      retry: false, // Don't retry on auth failures
    }
  );

  // Get appointment data only if access is validated
  const { data: appointmentData, isLoading: isAppointmentLoading, error: appointmentError } = api.appointment.getById.useQuery(
    { appointmentId },
    { 
      enabled: !!appointmentId && !!accessData?.hasAccess,
      retry: false,
    }
  );

  const { data: meData } = api.user.me.useQuery();

  const redirectPath = useMemo(() => {
    if (accessData?.userRole === 'doctor') {
      return '/doctor/appointments';
    } else if (accessData?.userRole === 'patient') {
      return '/patient/appointments';
    } else if (accessData?.userRole === 'admin') {
      return '/admin';
    }
    return '/sign-in';
  }, [accessData?.userRole]);

  const redirectOnce = useCallback(() => {
    router.replace(redirectPath);
  }, [router, redirectPath]);

  // Convert error to StreamVideoError format
  const toMeetingError = useCallback((error: unknown): StreamVideoError => {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    let code: string = 'STREAM_CONNECTION_FAILED';
    let message = 'Unable to join the meeting. Please try again.';
    let retryable = true;
    
    if (errorMessage.includes('access denied') || errorMessage.includes('unauthorized')) {
      code = 'STREAM_TOKEN_GENERATION_FAILED';
      message = 'You do not have permission to join this meeting.';
      retryable = false;
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      code = 'STREAM_MEETING_NOT_FOUND';
      message = 'The meeting could not be found. It may have been cancelled or ended.';
      retryable = false;
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      code = 'STREAM_NETWORK_ERROR';
      message = 'Network connection lost. Please check your internet connection.';
    } else if (errorMessage.includes('token') || errorMessage.includes('expired')) {
      code = 'STREAM_TOKEN_EXPIRED';
      message = 'Your session has expired. Please refresh the page to continue.';
      retryable = false;
    }

    const fallbackOptions: FallbackOption[] = retryable
      ? [
          { id: 'retry', label: 'Try Again', description: 'Attempt to join again', action: 'retry' },
          { id: 'refresh', label: 'Refresh Page', description: 'Reload the page', action: 'refresh' },
        ]
      : [
          { id: 'refresh', label: 'Refresh Page', description: 'Reload the page', action: 'refresh' },
          { id: 'contact', label: 'Contact Support', description: 'Get help', action: 'contact', href: '/support' },
        ];

    return {
      code: code as any,
      message,
      retryable,
      fallbackOptions,
    };
  }, []);

  // Handle meeting end - cleanup and redirect
  // Requirements: 8.2 - Proper resource cleanup when leaving meetings
  const handleMeetingEnd = useCallback(async () => {
    // Clean up the call state
    if (meetingState.call) {
      try {
        // Try to leave gracefully if still connected
        await meetingState.call.leave();
      } catch (error) {
        // Ignore errors during cleanup - call may already be ended
        console.log('Call cleanup:', error);
      }
    }
    
    // Clean up Stream client resources
    await cleanupResources();
    
    // Clear the meeting state
    setMeetingState(prev => ({
      ...prev,
      call: null,
      isJoining: false,
    }));
    
    // Redirect to appropriate dashboard
    redirectOnce();
  }, [meetingState.call, redirectOnce, cleanupResources]);

  const handleLeave = useCallback(async () => {
    await handleMeetingEnd();
  }, [handleMeetingEnd]);

  // Retry joining the meeting
  const handleRetry = useCallback(async () => {
    if (meetingState.retryCount >= 3) {
      setMeetingState(prev => ({
        ...prev,
        error: {
          code: 'STREAM_CONNECTION_FAILED' as any,
          message: 'Unable to join after multiple attempts. Please try again later or contact support.',
          retryable: false,
          fallbackOptions: [
            { id: 'refresh', label: 'Refresh Page', description: 'Reload the page', action: 'refresh' },
            { id: 'contact', label: 'Contact Support', description: 'Get help', action: 'contact', href: '/support' },
          ],
        },
      }));
      return;
    }

    setMeetingState(prev => ({
      ...prev,
      error: null,
      call: null,
      retryCount: prev.retryCount + 1,
    }));
  }, [meetingState.retryCount]);

  // Handle access validation results
  useEffect(() => {
    if (accessError) {
      setMeetingState(prev => ({
        ...prev,
        error: toMeetingError(accessError),
        accessValidated: false,
      }));
      return;
    }

    if (accessData) {
      if (!accessData.hasAccess) {
        setMeetingState(prev => ({
          ...prev,
          error: {
            code: 'STREAM_TOKEN_GENERATION_FAILED' as any,
            message: accessData.errorMessage || 'Access denied to this meeting',
            retryable: false,
            fallbackOptions: [
              { id: 'contact', label: 'Contact Support', description: 'Get help', action: 'contact', href: '/support' },
            ],
          },
          accessValidated: false,
          userRole: accessData.userRole,
        }));
        
        // Redirect after a short delay to show the error message
        setTimeout(() => {
          redirectOnce();
        }, 5000);
        return;
      }

      setMeetingState(prev => ({
        ...prev,
        accessValidated: true,
        userRole: accessData.userRole,
        error: null,
      }));
    }
  }, [accessData, accessError, redirectOnce, toMeetingError]);

  // Notify other party mutation
  const notifyMeetingJoinedMutation = api.meeting.notifyMeetingJoined.useMutation({
    onError: (error) => {
      console.error('Failed to notify other party:', error);
      // Don't fail the meeting join if notification fails
    },
  });

  // Initialize and join call only after access is validated
  useEffect(() => {
    if (!streamClient || !appointmentData || !meetingState.accessValidated || meetingState.call) return;
    // Also check if the client is still loading
    if (isClientLoading) return;

    const initializeCall = async () => {
      try {
        setMeetingState(prev => ({ ...prev, isJoining: true, error: null }));

        // Generate token with appointment validation (with retry)
        let tokenResponse;
        let lastError: unknown;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            tokenResponse = await generateStreamToken({ 
              appointmentId,
              callId: `appointment_${appointmentId}` 
            });
            break;
          } catch (err) {
            lastError = err;
            console.error(`Token generation attempt ${attempt + 1} failed:`, err);
            if (attempt < 2) {
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
          }
        }

        if (!tokenResponse) {
          throw lastError || new Error('Failed to generate token');
        }

        // Ensure the client is connected with the user token before joining
        // The StreamVideoProvider initializes the client, but we need to verify it's ready
        // Wait a brief moment for the client to be fully connected
        await new Promise(resolve => setTimeout(resolve, 100));

        // Create call ID from appointment ID
        const callId = `appointment_${appointmentId}`;
        const call = streamClient.call('default', callId);

        // Get the call state to check if it exists, then join
        try {
          await call.getOrCreate();
        } catch (getOrCreateError) {
          // If getOrCreate fails, the call might not exist yet - that's okay, join will create it
          console.debug('Call getOrCreate:', getOrCreateError);
        }

        // Join the call - create if it doesn't exist (for cases where Stream room creation failed during appointment booking)
        await call.join({ create: true });

        setMeetingState(prev => ({
          ...prev,
          call,
          isJoining: false,
        }));

        // Notify the other party that we've joined the meeting
        // This sends them a message with a "Join Meeting" button
        notifyMeetingJoinedMutation.mutate({ appointmentId });
      } catch (error) {
        const meetingError = toMeetingError(error);
        setMeetingState(prev => ({
          ...prev,
          error: meetingError,
          isJoining: false,
        }));
        console.error('Failed to initialize call:', error);
        
        // If it's a non-retryable error, redirect after showing the message
        if (!meetingError.retryable) {
          setTimeout(() => {
            redirectOnce();
          }, 5000);
        }
      }
    };

    initializeCall();
  }, [streamClient, appointmentData, appointmentId, meetingState.accessValidated, meetingState.call, redirectOnce, toMeetingError, isClientLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meetingState.call) {
        // Check if call is still active before trying to leave
        // This prevents "Cannot leave call that has already been left" errors
        try {
          const callState = meetingState.call.state?.callingState;
          if (callState && callState !== 'left' && callState !== 'idle') {
            meetingState.call.leave().catch(() => {
              // Silently ignore - call may already be left
            });
          }
        } catch {
          // Silently ignore cleanup errors
        }
      }
    };
  }, [meetingState.call]);

  const isLoading = isClientLoading || isAccessLoading || isAppointmentLoading || meetingState.isJoining;
  const error = clientError || meetingState.error;

  return (
    <div className="p-0">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">Stream Video Meeting</div>
          <button
            onClick={handleLeave}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Leave
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            {isAccessLoading ? 'Validating access...' : 'Loading meeting…'}
          </div>
        </div>
      )}

      {!isLoading && error && (
        <ErrorDisplay 
          error={error}
          onRetry={error.retryable ? handleRetry : undefined}
          isRetrying={meetingState.isJoining}
          userRole={meetingState.userRole}
        />
      )}

      {!isLoading && !error && meetingState.call && streamClient && meetingState.accessValidated && (
        <div className="h-[calc(100vh-56px)]">
          <StreamVideo client={streamClient}>
            <StreamCall call={meetingState.call}>
              <MeetingRoom 
                userRole={meetingState.userRole}
                onMeetingEnd={handleMeetingEnd}
                appointmentId={appointmentId}
              />
            </StreamCall>
          </StreamVideo>
        </div>
      )}
    </div>
  );
}
