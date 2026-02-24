"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Mail,
  MoreVertical,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  sendInvitation,
  revokeInvitation,
  updateTeamMemberRole,
  removeTeamMember,
} from "@/lib/actions/invitations"
import type { InvitationWithInviter } from "@/lib/queries/invitations"

interface TeamMember {
  staffId: string
  userId: string
  name: string
  email: string
  role: string
  avatarUrl?: string | null
}

interface TeamMembersTabProps {
  invitations: InvitationWithInviter[]
  teamMembers: TeamMember[]
  currentUserId: string
  currentUserRole: string
}

function getInvitationStatus(inv: InvitationWithInviter): "pending" | "accepted" | "expired" | "revoked" {
  if (inv.revokedAt) return "revoked"
  if (inv.acceptedAt) return "accepted"
  if (inv.expiresAt < new Date()) return "expired"
  return "pending"
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "default" },
  accepted: { label: "Accepted", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
  revoked: { label: "Revoked", variant: "destructive" },
}

const roleIcon = {
  owner: Shield,
  admin: ShieldAlert,
  staff: ShieldCheck,
}

const roleColor = {
  owner: "text-amber-600",
  admin: "text-red-600",
  staff: "text-muted-foreground",
}

export function TeamMembersTab({
  invitations: initialInvitations,
  teamMembers,
  currentUserId,
  currentUserRole,
}: TeamMembersTabProps) {
  const [invitations, setInvitations] = useState(initialInvitations)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteRole, setInviteRole] = useState<"staff" | "admin">("staff")
  const [isSending, setIsSending] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)

  const isOwner = currentUserRole === "owner"

  async function handleSendInvitation(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail || !inviteFirstName || !inviteLastName) return

    setIsSending(true)
    const result = await sendInvitation({
      email: inviteEmail,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      role: inviteRole,
    })
    setIsSending(false)

    if (result.success) {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail("")
      setInviteFirstName("")
      setInviteLastName("")
      setInviteRole("staff")
    } else {
      toast.error(result.error)
    }
  }

  async function handleRevoke(invitationId: string) {
    const result = await revokeInvitation(invitationId)
    if (result.success) {
      toast.success("Invitation revoked")
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitationId ? { ...inv, revokedAt: new Date() } : inv
        )
      )
    } else {
      toast.error(result.error)
    }
  }

  async function handleRoleChange(member: TeamMember, newRole: "staff" | "admin") {
    const result = await updateTeamMemberRole({ targetUserId: member.userId, newRole })
    if (result.success) {
      toast.success(`${member.name}'s role updated to ${newRole}`)
    } else {
      toast.error(result.error)
    }
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return
    const result = await removeTeamMember(memberToRemove.userId)
    setMemberToRemove(null)
    if (result.success) {
      toast.success(`${memberToRemove.name} has been removed`)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <UserPlus className="w-5 h-5 text-sal-500" />
            Invite Team Member
          </CardTitle>
          <CardDescription>
            Send an email invitation to add a new member to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  placeholder="Jane"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  placeholder="Smith"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="jane@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "staff" | "admin")}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSending} className="gap-2">
                <Mail className="w-4 h-4" />
                {isSending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Current Team */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Current Team</CardTitle>
          <CardDescription>Active members of your business</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No team members yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => {
                  const isCurrentUser = member.userId === currentUserId
                  const RoleIcon = roleIcon[member.role as keyof typeof roleIcon] ?? Shield
                  const rColor = roleColor[member.role as keyof typeof roleColor] ?? "text-muted-foreground"
                  const canChangeRole = isOwner && !isCurrentUser && member.role !== "owner"
                  const canRemove =
                    !isCurrentUser &&
                    member.role !== "owner" &&
                    (isOwner || member.role === "staff")

                  return (
                    <TableRow key={member.staffId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-sal-100 text-sal-700 text-xs">
                              {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {member.name}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">You</Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canChangeRole ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleRoleChange(member, v as "staff" | "admin")}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className={`flex items-center gap-1.5 text-sm ${rColor}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            <span className="capitalize">{member.role}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {canRemove && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-8 h-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setMemberToRemove(member)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Invitations</CardTitle>
            <CardDescription>Recent team invitations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const status = getInvitationStatus(inv)
                  const { label, variant } = statusBadge[status]
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{inv.firstName} {inv.lastName}</p>
                          <p className="text-xs text-muted-foreground">{inv.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{inv.role}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant}>{label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {inv.expiresAt.toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-red-600"
                            title="Revoke invitation"
                            onClick={() => handleRevoke(inv.id)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirm remove */}
      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => { if (!open) setMemberToRemove(null) }}
        title={`Remove ${memberToRemove?.name}?`}
        description="This will deactivate their access to this business. You can re-invite them later."
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
        variant="destructive"
      />
    </div>
  )
}
