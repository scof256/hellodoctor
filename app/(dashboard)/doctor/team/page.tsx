'use client';

import React, { useState } from 'react';
import { api } from '@/trpc/react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

type TeamRole = 'clinic_admin' | 'receptionist';

interface TeamMember {
  id: string;
  userId: string;
  role: TeamRole;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    imageUrl: string | null;
  };
}

const roleConfig = {
  clinic_admin: {
    label: 'Clinic Admin',
    description: 'Full access to patient data, messages, and scheduling',
    color: 'bg-purple-100 text-purple-700',
  },
  receptionist: {
    label: 'Receptionist',
    description: 'Can manage appointments only, no access to medical data',
    color: 'bg-blue-100 text-blue-700',
  },
};


function TeamMemberCard({
  member,
  onRemove,
  isRemoving,
}: {
  member: TeamMember;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const config = roleConfig[member.role];
  const memberName = member.user.firstName && member.user.lastName
    ? `${member.user.firstName} ${member.user.lastName}`
    : member.user.email || 'Unknown';

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
          {member.user.imageUrl ? (
            <img
              src={member.user.imageUrl}
              alt={memberName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            memberName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="font-medium text-slate-800">{memberName}</p>
          <p className="text-sm text-slate-500">{member.user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-slate-400">
              Since {new Date(member.effectiveFrom).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={isRemoving}
        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        title="Remove team member"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

function InviteForm({
  onInvite,
  isInviting,
  onCancel,
}: {
  onInvite: (email: string, role: TeamRole) => void;
  isInviting: boolean;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('receptionist');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onInvite(email, role);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Invite Team Member</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@clinic.com"
              required
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Role
          </label>
          <div className="space-y-2">
            {(Object.entries(roleConfig) as [TeamRole, typeof roleConfig.clinic_admin][]).map(([key, config]) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  role === key
                    ? 'border-medical-500 bg-medical-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={key}
                  checked={role === key}
                  onChange={() => setRole(key)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-slate-800">{config.label}</p>
                  <p className="text-sm text-slate-500">{config.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!email || isInviting}
          className="w-full py-2.5 bg-medical-600 text-white rounded-lg font-medium hover:bg-medical-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isInviting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending Invitation...
            </>
          ) : (
            <>
              <Mail className="w-5 h-5" />
              Send Invitation
            </>
          )}
        </button>
      </div>
    </form>
  );
}


export default function DoctorTeamPage() {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Note: Team management API endpoints would need to be implemented
  // For now, we show a placeholder UI that demonstrates the intended functionality

  const teamMembers: TeamMember[] = []; // Would come from API
  const isLoading = false;

  const handleInvite = async (email: string, role: TeamRole) => {
    // This would call the team invitation API
    setMessage({
      type: 'info',
      text: 'Team invitation feature is coming soon. The invitation would be sent to ' + email,
    });
    setShowInviteForm(false);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRemove = async (memberId: string) => {
    // This would call the remove team member API
    setMessage({
      type: 'info',
      text: 'Team member removal feature is coming soon.',
    });
    setTimeout(() => setMessage(null), 5000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Team Management</h1>
          <p className="text-slate-500 mt-1">
            Manage your clinic staff and their access permissions
          </p>
        </div>
        {!showInviteForm && (
          <button
            onClick={() => setShowInviteForm(true)}
            className="px-4 py-2.5 bg-medical-600 text-white rounded-xl font-medium hover:bg-medical-700 transition-colors flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Invite Team Member
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' :
          message.type === 'error' ? 'bg-red-50 text-red-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : message.type === 'error' ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <InviteForm
          onInvite={handleInvite}
          isInviting={false}
          onCancel={() => setShowInviteForm(false)}
        />
      )}

      {/* Role Permissions Info */}
      <div className="bg-slate-50 rounded-xl p-6">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-medical-600" />
          Role Permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.entries(roleConfig) as [TeamRole, typeof roleConfig.clinic_admin][]).map(([key, config]) => (
            <div key={key} className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-slate-600">{config.description}</p>
              <ul className="mt-3 space-y-1">
                {key === 'clinic_admin' ? (
                  <>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      View patient intake data
                    </li>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Send messages on your behalf
                    </li>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Manage appointments
                    </li>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Manage availability
                    </li>
                  </>
                ) : (
                  <>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      View appointments
                    </li>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Book and reschedule appointments
                    </li>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <X className="w-3 h-3 text-red-400" />
                      No access to medical data
                    </li>
                    <li className="text-xs text-slate-500 flex items-center gap-1">
                      <X className="w-3 h-3 text-red-400" />
                      Cannot send messages
                    </li>
                  </>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Team Members List */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-medical-600" />
          Team Members ({teamMembers.length})
        </h3>
        
        {teamMembers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-medium text-slate-600 mb-1">No team members yet</h3>
            <p className="text-sm text-slate-400 mb-4">
              Invite clinic staff to help manage your practice
            </p>
            {!showInviteForm && (
              <button
                onClick={() => setShowInviteForm(true)}
                className="px-4 py-2 bg-medical-600 text-white rounded-lg font-medium hover:bg-medical-700 transition-colors inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite First Team Member
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                onRemove={() => handleRemove(member.id)}
                isRemoving={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
