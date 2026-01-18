'use client';

import React, { useState } from 'react';
import { api } from '@/trpc/react';
import {
  Stethoscope,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  Shield,
  AlertCircle,
} from 'lucide-react';

type VerificationStatus = 'pending' | 'verified' | 'rejected';

const statusColors: Record<VerificationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusIcons: Record<VerificationStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  verified: <CheckCircle className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
};

export default function AdminDoctorsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | ''>('');
  const [page, setPage] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingDoctorId, setPendingDoctorId] = useState<string | null>(null);
  const limit = 20;

  const { data, isLoading, refetch } = api.admin.getAllDoctors.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    limit,
    offset: page * limit,
  });

  const { data: pendingData } = api.admin.getPendingDoctors.useQuery({
    limit: 100,
    offset: 0,
  });

  const verifyMutation = api.admin.verifyDoctor.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedDoctor(null);
      setShowRejectModal(false);
      setRejectReason('');
      setPendingDoctorId(null);
    },
  });


  const handleApprove = (doctorId: string) => {
    verifyMutation.mutate({
      doctorId,
      action: 'approve',
    });
  };

  const handleReject = (doctorId: string) => {
    setPendingDoctorId(doctorId);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (pendingDoctorId) {
      verifyMutation.mutate({
        doctorId: pendingDoctorId,
        action: 'reject',
        reason: rejectReason || undefined,
      });
    }
  };

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const selectedDoctorData = data?.doctors.find(d => d.id === selectedDoctor);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-blue-600" />
            Doctor Verification
          </h1>
          <p className="text-gray-600 mt-1">
            Review and verify doctor credentials
          </p>
        </div>
        {pendingData && pendingData.total > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 font-medium">
              {pendingData.total} pending verification{pendingData.total > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, specialty..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as VerificationStatus | '');
                  setPage(0);
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </div>


      {/* Pending Verification Queue */}
      {!statusFilter && pendingData && pendingData.doctors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Verification Queue
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingData.doctors.slice(0, 6).map((doctor) => (
              <div key={doctor.id} className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                    {doctor.user?.firstName?.[0] || doctor.user?.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {doctor.user?.firstName && doctor.user?.lastName
                        ? `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`
                        : doctor.user?.email || 'Unknown'}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{doctor.specialty || 'No specialty'}</p>
                    <p className="text-xs text-gray-400 mt-1">Applied {formatDate(doctor.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedDoctor(doctor.id)}
                    className="flex-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    <Eye className="w-4 h-4 inline mr-1" />
                    View
                  </button>
                  <button
                    onClick={() => handleApprove(doctor.id)}
                    disabled={verifyMutation.isPending}
                    className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctors Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">All Doctors</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            Loading doctors...
          </div>
        ) : data?.doctors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            No doctors found matching your criteria
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Specialty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clinic
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.doctors.map((doctor) => (
                <tr key={doctor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {doctor.user?.firstName?.[0] || doctor.user?.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {doctor.user?.firstName && doctor.user?.lastName
                            ? `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`
                            : 'No name'}
                        </div>
                        <div className="text-sm text-gray-500">{doctor.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {doctor.specialty || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doctor.clinicName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[doctor.verificationStatus as VerificationStatus]}`}>
                      {statusIcons[doctor.verificationStatus as VerificationStatus]}
                      {doctor.verificationStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(doctor.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedDoctor(doctor.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {doctor.verificationStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(doctor.id)}
                            disabled={verifyMutation.isPending}
                            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={() => handleReject(doctor.id)}
                            disabled={verifyMutation.isPending}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}


        {/* Pagination */}
        {(data?.total ?? 0) > limit && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total ?? 0} doctors
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Doctor Details Modal */}
      {selectedDoctor && selectedDoctorData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Doctor Details</h2>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Doctor Info */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-medium">
                  {selectedDoctorData.user?.firstName?.[0] || selectedDoctorData.user?.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">
                    {selectedDoctorData.user?.firstName && selectedDoctorData.user?.lastName
                      ? `Dr. ${selectedDoctorData.user.firstName} ${selectedDoctorData.user.lastName}`
                      : 'No name set'}
                  </h3>
                  <p className="text-gray-500">{selectedDoctorData.specialty || 'No specialty set'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedDoctorData.verificationStatus as VerificationStatus]}`}>
                      {statusIcons[selectedDoctorData.verificationStatus as VerificationStatus]}
                      {selectedDoctorData.verificationStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{selectedDoctorData.user?.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{selectedDoctorData.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span>{selectedDoctorData.clinicName || 'No clinic'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{selectedDoctorData.address || 'No address'}</span>
                </div>
              </div>

              {/* Bio */}
              {selectedDoctorData.bio && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Bio</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    {selectedDoctorData.bio}
                  </p>
                </div>
              )}

              {/* Profile Details */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
                <div>
                  <span className="text-xs text-blue-600 font-medium">Profile Slug</span>
                  <p className="text-sm">{selectedDoctorData.slug}</p>
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-medium">Appointment Duration</span>
                  <p className="text-sm">{selectedDoctorData.appointmentDuration} minutes</p>
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-medium">Buffer Time</span>
                  <p className="text-sm">{selectedDoctorData.bufferTime} minutes</p>
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-medium">Registered</span>
                  <p className="text-sm">{formatDate(selectedDoctorData.createdAt)}</p>
                </div>
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedDoctorData.verificationStatus === 'rejected' && selectedDoctorData.rejectionReason && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Rejection Reason
                  </h4>
                  <p className="text-sm text-red-700">{selectedDoctorData.rejectionReason}</p>
                </div>
              )}

              {/* Verification Info (if verified) */}
              {selectedDoctorData.verificationStatus === 'verified' && selectedDoctorData.verifiedAt && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Verification Details
                  </h4>
                  <p className="text-sm text-green-700">
                    Verified on {formatDate(selectedDoctorData.verifiedAt)}
                  </p>
                </div>
              )}

              {/* Actions */}
              {selectedDoctorData.verificationStatus === 'pending' && (
                <div className="mt-6 pt-6 border-t flex gap-3">
                  <button
                    onClick={() => handleApprove(selectedDoctorData.id)}
                    disabled={verifyMutation.isPending}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Doctor
                  </button>
                  <button
                    onClick={() => handleReject(selectedDoctorData.id)}
                    disabled={verifyMutation.isPending}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject Doctor Verification
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this doctor&apos;s verification request. This will be communicated to the doctor.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setPendingDoctorId(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={verifyMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {verifyMutation.isPending ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
