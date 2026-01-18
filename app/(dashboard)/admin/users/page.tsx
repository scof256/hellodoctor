'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/trpc/react';
import {
  Users,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Calendar,
  Shield,
  UserCheck,
  UserX,
  MoreVertical,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';

type UserRole = 'super_admin' | 'doctor' | 'clinic_admin' | 'receptionist' | 'patient';

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  doctor: 'bg-blue-100 text-blue-800',
  clinic_admin: 'bg-green-100 text-green-800',
  receptionist: 'bg-yellow-100 text-yellow-800',
  patient: 'bg-gray-100 text-gray-800',
};

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  doctor: 'Doctor',
  clinic_admin: 'Clinic Admin',
  receptionist: 'Receptionist',
  patient: 'Patient',
};

const ALL_ROLES: UserRole[] = ['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient'];

// Dropdown Portal Component
function DropdownPortal({ 
  children, 
  anchorRef, 
  isOpen 
}: { 
  children: React.ReactNode; 
  anchorRef: React.RefObject<HTMLButtonElement | null>; 
  isOpen: boolean;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const dropdownWidth = 224; // w-56
      const submenuWidth = 192; // w-48
      const viewportWidth = window.innerWidth;
      
      // Check if there's enough space on the right for dropdown + submenu
      const spaceOnRight = viewportWidth - rect.right;
      const needsLeftPosition = spaceOnRight < (dropdownWidth + submenuWidth + 20);
      
      setOpenLeft(needsLeftPosition);
      setPosition({
        top: rect.bottom + 4,
        left: needsLeftPosition 
          ? Math.max(8, rect.left - dropdownWidth + rect.width) 
          : rect.right - dropdownWidth,
      });
    }
  }, [isOpen, anchorRef]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div 
      className="fixed z-[9999]" 
      style={{ top: position.top, left: Math.max(8, position.left) }}
      data-open-left={openLeft}
    >
      {children}
    </div>,
    document.body
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ userId: string; currentRole: UserRole; newRole: UserRole } | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showRoleSubmenu, setShowRoleSubmenu] = useState(false);
  const [submenuLeft, setSubmenuLeft] = useState(false);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const limit = 20;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Check if click is on a button ref
        let clickedOnButton = false;
        buttonRefs.current.forEach((btn) => {
          if (btn && btn.contains(event.target as Node)) {
            clickedOnButton = true;
          }
        });
        if (!clickedOnButton) {
          setOpenDropdown(null);
          setShowRoleSubmenu(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isLoading, refetch } = api.admin.getUsers.useQuery({
    search: search || undefined,
    role: roleFilter || undefined,
    isActive: statusFilter === '' ? undefined : statusFilter === 'active',
    limit,
    offset: page * limit,
  });

  const { data: userDetails } = api.admin.getUserById.useQuery(
    { userId: selectedUser! },
    { enabled: !!selectedUser }
  );

  const updateStatusMutation = api.admin.updateUserStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const updateRoleMutation = api.admin.updateUserRole.useMutation({
    onSuccess: () => {
      refetch();
      setShowRoleModal(false);
      setPendingRoleChange(null);
    },
  });

  const handleToggleStatus = (userId: string, currentStatus: boolean) => {
    updateStatusMutation.mutate({
      userId,
      isActive: !currentStatus,
      reason: !currentStatus ? undefined : 'Suspended by admin',
    });
    setOpenDropdown(null);
  };

  const handleRoleChange = (userId: string, currentRole: UserRole, newRole: UserRole) => {
    setPendingRoleChange({ userId, currentRole, newRole });
    setShowRoleModal(true);
    setOpenDropdown(null);
    setShowRoleSubmenu(false);
  };

  const confirmRoleChange = () => {
    if (pendingRoleChange) {
      updateRoleMutation.mutate({ userId: pendingRoleChange.userId, role: pendingRoleChange.newRole });
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-blue-600" />
          User Management
        </h1>
        <p className="text-gray-600 mt-1">
          View and manage all platform users
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="w-40">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as UserRole | '');
                setPage(0);
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="doctor">Doctor</option>
              <option value="clinic_admin">Clinic Admin</option>
              <option value="receptionist">Receptionist</option>
              <option value="patient">Patient</option>
            </select>
          </div>

          <div className="w-36">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'active' | 'inactive' | '');
                setPage(0);
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-visible">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            Loading users...
          </div>
        ) : data?.users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                          {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : 'No name'}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.primaryRole as UserRole]}`}>
                        {roleLabels[user.primaryRole as UserRole]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button 
                          ref={(el) => {
                            if (el) buttonRefs.current.set(user.id, el);
                          }}
                          onClick={() => {
                            if (openDropdown !== user.id) {
                              // Calculate if submenu should open left
                              const btn = buttonRefs.current.get(user.id);
                              if (btn) {
                                const rect = btn.getBoundingClientRect();
                                const spaceOnRight = window.innerWidth - rect.right;
                                setSubmenuLeft(spaceOnRight < 480); // dropdown + submenu width
                              }
                            }
                            setOpenDropdown(openDropdown === user.id ? null : user.id);
                            setShowRoleSubmenu(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        <DropdownPortal 
                          anchorRef={{ current: buttonRefs.current.get(user.id) || null }}
                          isOpen={openDropdown === user.id}
                        >
                          <div ref={dropdownRef} className="w-56 bg-white rounded-lg shadow-xl border py-1">
                            <button
                              onClick={() => handleToggleStatus(user.id, user.isActive)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              {user.isActive ? 'Suspend User' : 'Activate User'}
                            </button>
                            <div className="border-t my-1" />
                            <div className="relative">
                              <button
                                onClick={() => setShowRoleSubmenu(!showRoleSubmenu)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  <Shield className="w-4 h-4" />
                                  Change Role
                                </span>
                                <ChevronRightIcon className={`w-4 h-4 transition-transform ${submenuLeft ? 'rotate-180' : ''}`} />
                              </button>
                              {showRoleSubmenu && (
                                <div className={`absolute top-0 w-48 bg-white rounded-lg shadow-xl border py-1 ${
                                  submenuLeft ? 'right-full mr-1' : 'left-full ml-1'
                                }`}>
                                  {ALL_ROLES.map((role) => (
                                    <button
                                      key={role}
                                      onClick={() => handleRoleChange(user.id, user.primaryRole as UserRole, role)}
                                      disabled={user.primaryRole === role}
                                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                                        user.primaryRole === role ? 'bg-gray-100' : ''
                                      }`}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${roleColors[role].split(' ')[0]}`} />
                                      {roleLabels[role]}
                                      {user.primaryRole === role && (
                                        <span className="ml-auto text-xs text-gray-400">(current)</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </DropdownPortal>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(data?.total ?? 0) > limit && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, data?.total ?? 0)} of {data?.total ?? 0}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && userDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">User Details</h2>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-medium">
                  {userDetails.user.firstName?.[0] || userDetails.user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {userDetails.user.firstName && userDetails.user.lastName
                      ? `${userDetails.user.firstName} ${userDetails.user.lastName}`
                      : 'No name'}
                  </h3>
                  <p className="text-gray-500">{userDetails.user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[userDetails.user.primaryRole as UserRole]}`}>
                      {roleLabels[userDetails.user.primaryRole as UserRole]}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      userDetails.user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {userDetails.user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{userDetails.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>Joined {formatDate(userDetails.user.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span>Clerk ID: {userDetails.user.clerkId.slice(0, 20)}...</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>{userDetails.connectionCount} connections</span>
                </div>
              </div>

              {userDetails.recentActivity.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Recent Activity</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userDetails.recentActivity.map((activity) => (
                      <div key={activity.id} className="text-sm p-2 bg-gray-50 rounded">
                        <span className="font-medium">{activity.action}</span>
                        <span className="text-gray-500 ml-2">{formatDate(activity.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleModal && pendingRoleChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Confirm Role Change
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to change this user&apos;s role?
            </p>
            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Current Role</div>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${roleColors[pendingRoleChange.currentRole]}`}>
                  {roleLabels[pendingRoleChange.currentRole]}
                </span>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">New Role</div>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${roleColors[pendingRoleChange.newRole]}`}>
                  {roleLabels[pendingRoleChange.newRole]}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setPendingRoleChange(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={updateRoleMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updateRoleMutation.isPending ? 'Updating...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
