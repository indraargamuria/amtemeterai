import { useState, useEffect } from "react"
import { Card, CardContent } from "../../shared/components/ui/Card"
import { Button } from "../../shared/components/ui/Button"
import { Input } from "../../shared/components/ui/Input"
import { Badge } from "../../shared/components/ui/Badge"
import { Checkbox } from "../../shared/components/ui/Checkbox"
import { Label } from "../../shared/components/ui/Label"
import { useApi } from "../../shared/utils/api"

interface User {
  id: string
  fullName: string
  email: string
  lastLoginAt: string | null
  createdAt: string
}

interface Plant {
  plantCode: string
  plantName: string
}

interface Role {
  id: string
  name: string
}

interface UserMatrixData {
  userId: string
  fullName: string
  email: string
  assignedPlants: string[]
  assignedRoles: string[]
  allPlants: Plant[]
  allRoles: Role[]
}

interface SystemMenu {
  menuCode: string
  menuName: string
}

interface RoleMenuData {
  roles: string[]
  menus: SystemMenu[]
}

// Role descriptions for UI
const roleDescriptions: Record<string, { title: string; description: string; color: string }> = {
  sysadmin: {
    title: "System Administrator",
    description: "Full system access including user management and all operational data",
    color: "text-brand-red"
  },
  sales: {
    title: "Sales User",
    description: "Access to customer management and delivery operations",
    color: "text-brand-blue"
  },
  finance: {
    title: "Finance User",
    description: "Access to invoice processing and financial reporting",
    color: "text-emerald-600"
  },
}

type MainTabValue = "user-mapping" | "role-menu-matrix"
type UserTabValue = "plants" | "roles"

export function UserAccessManagementPage() {
  // State for user mapping tab
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [matrixData, setMatrixData] = useState<UserMatrixData | null>(null)
  const [selectedPlants, setSelectedPlants] = useState<Set<string>>(new Set())
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  // State for role-menu matrix tab
  const [roleMenuData, setRoleMenuData] = useState<RoleMenuData | null>(null)
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null)
  const [selectedRoleMenus, setSelectedRoleMenus] = useState<Set<string>>(new Set())
  const [roleMenuLoading, setRoleMenuLoading] = useState(false)
  const [savingRoleMenus, setSavingRoleMenus] = useState(false)

  // Common state
  const [loading, setLoading] = useState(true)
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [activeMainTab, setActiveMainTab] = useState<MainTabValue>("user-mapping")
  const [activeUserTab, setActiveUserTab] = useState<UserTabValue>("plants")

  const api = useApi()

  // Fetch all users and role-menu data on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch users
        const usersRes = await api.get("/api/admin/uam/users")
        if (usersRes.ok) {
          const data: User[] = await usersRes.json()
          setUsers(data)
        }

        // Fetch roles and menus
        const rolesRes = await api.get("/api/admin/uam/roles")
        if (rolesRes.ok) {
          const data: RoleMenuData = await rolesRes.json()
          setRoleMenuData(data)
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err)
      } finally {
        setLoading(false)
      }
    }
    fetchInitialData()
  }, [])

  // Fetch user matrix when a user is selected
  useEffect(() => {
    if (!selectedUserId) {
      setMatrixData(null)
      setSelectedPlants(new Set())
      setSelectedRoles(new Set())
      return
    }

    const fetchMatrix = async () => {
      setMatrixLoading(true)
      try {
        const res = await api.get(`/api/admin/uam/users/${selectedUserId}/matrix`)
        if (!res.ok) {
          throw new Error("Failed to fetch user matrix")
        }
        const data: UserMatrixData = await res.json()
        setMatrixData(data)
        setSelectedPlants(new Set(data.assignedPlants))
        setSelectedRoles(new Set(data.assignedRoles))
      } catch (err) {
        console.error("Failed to fetch user matrix", err)
      } finally {
        setMatrixLoading(false)
      }
    }
    fetchMatrix()
  }, [selectedUserId])

  // Fetch role menus when a role is selected
  useEffect(() => {
    if (!selectedRoleName) {
      setSelectedRoleMenus(new Set())
      return
    }

    const fetchRoleMenus = async () => {
      setRoleMenuLoading(true)
      try {
        const res = await api.get(`/api/admin/uam/roles/${selectedRoleName}/menus`)
        if (!res.ok) {
          throw new Error("Failed to fetch role menus")
        }
        const data: { roleName: string; menuCodes: string[] } = await res.json()
        setSelectedRoleMenus(new Set(data.menuCodes))
      } catch (err) {
        console.error("Failed to fetch role menus", err)
      } finally {
        setRoleMenuLoading(false)
      }
    }
    fetchRoleMenus()
  }, [selectedRoleName])

  const handleSaveUserMatrix = async () => {
    if (!selectedUserId) return

    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await api.post(`/api/admin/uam/users/${selectedUserId}/matrix`, {
        selectedPlants: Array.from(selectedPlants),
        selectedRoles: Array.from(selectedRoles),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to update user permissions")
      }
      const data = await res.json()
      setSaveMessage(data.message || "User permissions updated successfully")
    } catch (err: any) {
      console.error("Failed to update user permissions", err)
      setSaveMessage(err.message || "Failed to update user permissions. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRoleMenus = async () => {
    if (!selectedRoleName) return

    setSavingRoleMenus(true)
    setSaveMessage(null)
    try {
      const res = await api.post(`/api/admin/uam/roles/${selectedRoleName}/menus`, {
        selectedMenus: Array.from(selectedRoleMenus),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to update role menus")
      }
      const data = await res.json()
      setSaveMessage(data.message || "Role menu permissions updated successfully")
    } catch (err: any) {
      console.error("Failed to update role menus", err)
      setSaveMessage(err.message || "Failed to update role menus. Please try again.")
    } finally {
      setSavingRoleMenus(false)
    }
  }

  const handlePlantToggle = (plantCode: string) => {
    const newSelected = new Set(selectedPlants)
    if (newSelected.has(plantCode)) {
      newSelected.delete(plantCode)
    } else {
      newSelected.add(plantCode)
    }
    setSelectedPlants(newSelected)
  }

  const handleRoleToggle = (roleName: string) => {
    const newSelected = new Set(selectedRoles)
    if (newSelected.has(roleName)) {
      newSelected.delete(roleName)
    } else {
      newSelected.add(roleName)
    }
    setSelectedRoles(newSelected)
  }

  const handleRoleMenuToggle = (menuCode: string) => {
    const newSelected = new Set(selectedRoleMenus)
    if (newSelected.has(menuCode)) {
      newSelected.delete(menuCode)
    } else {
      newSelected.add(menuCode)
    }
    setSelectedRoleMenus(newSelected)
  }

  const handleSelectAllPlants = () => {
    if (!matrixData) return
    if (selectedPlants.size === matrixData.allPlants.length) {
      setSelectedPlants(new Set())
    } else {
      setSelectedPlants(new Set(matrixData.allPlants.map((p) => p.plantCode)))
    }
  }

  const handleSelectAllMenus = () => {
    if (!roleMenuData) return
    if (selectedRoleMenus.size === roleMenuData.menus.length) {
      setSelectedRoleMenus(new Set())
    } else {
      setSelectedRoleMenus(new Set(roleMenuData.menus.map((m) => m.menuCode)))
    }
  }

  // Filter users by search query
  const filteredUsers = users.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hasUserChanges = matrixData
    ? selectedPlants.size !== matrixData.assignedPlants.length ||
      selectedRoles.size !== matrixData.assignedRoles.length ||
      Array.from(selectedRoles).some((r) => !matrixData.assignedRoles.includes(r)) ||
      matrixData.assignedRoles.some((r) => !selectedRoles.has(r))
    : false

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
            User Access Management
          </h1>
          <p className="text-sm text-brand-blue/60">
            Manage plant-level data access, system roles, and menu permissions
          </p>
        </div>
      </div>

      {/* Save Message Alert */}
      {saveMessage && (
        <Card
          className={`border ${
            saveMessage.includes("failed") || saveMessage.includes("Cannot")
              ? "border-brand-red/20 bg-brand-red/5"
              : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p
              className={`text-sm ${
                saveMessage.includes("failed") || saveMessage.includes("Cannot")
                  ? "text-brand-red font-medium"
                  : "text-emerald-700 font-medium"
              }`}
            >
              {saveMessage}
            </p>
            <button
              onClick={() => setSaveMessage(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-medium"
            >
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Card>
        <div className="border-b border-slate-100">
          <div className="flex">
            <button
              onClick={() => setActiveMainTab("user-mapping")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeMainTab === "user-mapping"
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-brand-blue/50 hover:text-brand-blue/70"
              }`}
            >
              User Mapping
            </button>
            <button
              onClick={() => setActiveMainTab("role-menu-matrix")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeMainTab === "role-menu-matrix"
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-brand-blue/50 hover:text-brand-blue/70"
              }`}
            >
              Role Menu Matrix
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* User Mapping Tab */}
          {activeMainTab === "user-mapping" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - User List */}
              <div className="lg:col-span-1 space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-brand-blue/70">
                    Search Users
                  </Label>
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-brand-blue/5"
                  />
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-y-auto">
                      {loading ? (
                        <div className="p-8 text-center text-brand-blue/60">
                          Loading users...
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-brand-blue/60">
                          No users found
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setSelectedUserId(user.id)
                                setActiveUserTab("plants")
                              }}
                              className={`w-full text-left p-4 hover:bg-brand-blue/[0.02] transition-colors ${
                                selectedUserId === user.id
                                  ? "bg-brand-blue/10 border-l-2 border-brand-blue"
                                  : ""
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-brand-blue">
                                    {user.fullName?.charAt(0).toUpperCase() ||
                                      user.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-brand-blue truncate">
                                    {user.fullName || "Unknown User"}
                                  </p>
                                  <p className="text-xs text-brand-blue/50 truncate">
                                    {user.email}
                                  </p>
                                  <p className="text-xs text-brand-blue/40 mt-1">
                                    Last login:{" "}
                                    {user.lastLoginAt
                                      ? new Date(user.lastLoginAt).toLocaleDateString()
                                      : "Never"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - User Permission Matrix */}
              <div className="lg:col-span-2">
                {matrixLoading ? (
                  <Card>
                    <CardContent className="p-12 text-center text-brand-blue/60">
                      Loading permissions...
                    </CardContent>
                  </Card>
                ) : !matrixData ? (
                  <Card>
                    <CardContent className="p-12 text-center text-brand-blue/60">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 text-brand-blue/30"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <p>Select a user from the list to manage their access</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    {/* User Info Header */}
                    <div className="p-6 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-brand-blue">
                            {matrixData.fullName || "Unknown User"}
                          </h2>
                          <p className="text-sm text-brand-blue/50">
                            {matrixData.email}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge
                            variant="outline"
                            className="border-brand-blue/20 text-brand-blue/70"
                          >
                            {selectedPlants.size} plant
                            {selectedPlants.size !== 1 ? "s" : ""}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={selectedRoles.size > 0 ? "border-brand-red/20 text-brand-red/70" : "border-slate-200 text-slate-500"}
                          >
                            {selectedRoles.size} role
                            {selectedRoles.size !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* User Sub-Tabs */}
                    <div className="border-b border-slate-100">
                      <div className="flex">
                        <button
                          onClick={() => setActiveUserTab("plants")}
                          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeUserTab === "plants"
                              ? "border-brand-blue text-brand-blue"
                              : "border-transparent text-brand-blue/50 hover:text-brand-blue/70"
                          }`}
                        >
                          Plant Authorizations
                        </button>
                        <button
                          onClick={() => setActiveUserTab("roles")}
                          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeUserTab === "roles"
                              ? "border-brand-blue text-brand-blue"
                              : "border-transparent text-brand-blue/50 hover:text-brand-blue/70"
                          }`}
                        >
                          System Role Access
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Plants Sub-Tab */}
                      {activeUserTab === "plants" && (
                        <>
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={
                                  matrixData.allPlants.length > 0 &&
                                  selectedPlants.size === matrixData.allPlants.length
                                }
                                onChange={handleSelectAllPlants}
                                id="select-all-plants"
                              />
                              <Label
                                htmlFor="select-all-plants"
                                className="cursor-pointer text-sm font-medium text-brand-blue"
                              >
                                Select All Plants
                              </Label>
                            </div>
                            <span className="text-xs text-brand-blue/50">
                              {selectedPlants.size} / {matrixData.allPlants.length} selected
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            {matrixData.allPlants.map((plant) => (
                              <div
                                key={plant.plantCode}
                                className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                                  selectedPlants.has(plant.plantCode)
                                    ? "bg-brand-blue/5 border-brand-blue/30"
                                    : "bg-white border-slate-100 hover:border-slate-200"
                                }`}
                              >
                                <Checkbox
                                  checked={selectedPlants.has(plant.plantCode)}
                                  onChange={() => handlePlantToggle(plant.plantCode)}
                                  id={`plant-${plant.plantCode}`}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`plant-${plant.plantCode}`}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-brand-blue text-sm">
                                        {plant.plantCode}
                                      </span>
                                      <Badge
                                        variant="badge"
                                        className="text-brand-blue/60 font-normal text-xs"
                                      >
                                        {plant.plantName}
                                      </Badge>
                                    </div>
                                  </Label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Roles Sub-Tab */}
                      {activeUserTab === "roles" && (
                        <div className="space-y-3 mb-6">
                          {matrixData.allRoles.map((role) => {
                            const roleInfo = roleDescriptions[role.name] || {
                              title: role.name,
                              description: "System role",
                              color: "text-brand-blue"
                            }
                            const isSelected = selectedRoles.has(role.name)

                            return (
                              <div
                                key={role.id}
                                className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                                  isSelected
                                    ? role.name === "sysadmin"
                                      ? "bg-brand-red/5 border-brand-red/30"
                                      : "bg-brand-blue/5 border-brand-blue/30"
                                    : "bg-white border-slate-100 hover:border-slate-200"
                                }`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => handleRoleToggle(role.name)}
                                  id={`user-role-${role.id}`}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`user-role-${role.id}`}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={`font-medium ${roleInfo.color} text-sm`}>
                                        {roleInfo.title}
                                      </span>
                                      <Badge
                                        variant={role.name === "sysadmin" ? "badge" : "outline"}
                                        className={
                                          role.name === "sysadmin"
                                            ? "text-brand-red/70 bg-brand-red/5 border-brand-red/20"
                                            : "text-brand-blue/60 border-slate-200"
                                        }
                                      >
                                        @{role.name}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-brand-blue/50">
                                      {roleInfo.description}
                                    </p>
                                  </Label>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <span className="text-xs text-brand-blue/40">
                          {hasUserChanges ? "• Unsaved changes" : ""}
                        </span>
                        <Button
                          onClick={handleSaveUserMatrix}
                          disabled={saving || !hasUserChanges}
                          className="min-w-[180px]"
                        >
                          {saving ? "Saving..." : "Apply Permissions"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Role Menu Matrix Tab */}
          {activeMainTab === "role-menu-matrix" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Role List */}
              <div className="lg:col-span-1 space-y-4">
                <Label className="text-sm font-medium text-brand-blue/70">
                  Select Role to Configure
                </Label>

                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {roleMenuData?.roles.map((roleName) => (
                        <button
                          key={roleName}
                          onClick={() => setSelectedRoleName(roleName)}
                          className={`w-full text-left p-4 hover:bg-brand-blue/[0.02] transition-colors ${
                            selectedRoleName === roleName
                              ? "bg-brand-blue/10 border-l-2 border-brand-blue"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                roleName === "sysadmin"
                                  ? "bg-brand-red/10"
                                  : "bg-brand-blue/10"
                              }`}>
                                <span className={`text-xs font-semibold ${
                                  roleName === "sysadmin" ? "text-brand-red" : "text-brand-blue"
                                }`}>
                                  {roleName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className={`text-sm font-medium ${
                                roleName === "sysadmin" ? "text-brand-red" : "text-brand-blue"
                              }`}>
                                {roleName}
                              </span>
                            </div>
                            {roleDescriptions[roleName] && (
                              <Badge
                                variant="outline"
                                className={`text-xs font-normal ${
                                  roleName === "sysadmin"
                                    ? "border-brand-red/20 text-brand-red/70"
                                    : "border-brand-blue/20 text-brand-blue/70"
                                }`}
                              >
                                {roleDescriptions[roleName].title}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Menu Assignment */}
              <div className="lg:col-span-2">
                {!selectedRoleName ? (
                  <Card>
                    <CardContent className="p-12 text-center text-brand-blue/60">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 text-brand-blue/30"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M10 21h5a2 2 0 002-2V8a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 002 2zm9-1a2 2 0 002-2V8a2 2 0 00-2-2h-3a2 2 0 00-2 2v5a2 2 0 002 2z"
                        />
                      </svg>
                      <p>Select a role from the list to manage its menu permissions</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    {/* Role Info Header */}
                    <div className="p-6 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-brand-blue">
                            {roleDescriptions[selectedRoleName]?.title || selectedRoleName}
                          </h2>
                          <p className="text-sm text-brand-blue/50">
                            Configure which menus this role can access
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={selectedRoleName === "sysadmin"
                            ? "border-brand-red/20 text-brand-red/70"
                            : "border-brand-blue/20 text-brand-blue/70"
                          }
                        >
                          {selectedRoleMenus.size} / {roleMenuData?.menus.length || 0} menus
                        </Badge>
                      </div>
                    </div>

                    <div className="p-6">
                      {roleMenuLoading ? (
                        <div className="text-center text-brand-blue/60 py-8">
                          Loading menu permissions...
                        </div>
                      ) : (
                        <>
                          {/* Select All Toggle */}
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={
                                  !!roleMenuData &&
                                  roleMenuData.menus.length > 0 &&
                                  selectedRoleMenus.size === roleMenuData.menus.length
                                }
                                onChange={handleSelectAllMenus}
                                id="select-all-menus"
                              />
                              <Label
                                htmlFor="select-all-menus"
                                className="cursor-pointer text-sm font-medium text-brand-blue"
                              >
                                Select All Menus
                              </Label>
                            </div>
                            <span className="text-xs text-brand-blue/50">
                              {selectedRoleMenus.size} / {roleMenuData?.menus.length || 0} selected
                            </span>
                          </div>

                          {/* Menu Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            {roleMenuData?.menus.map((menu) => (
                              <div
                                key={menu.menuCode}
                                className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                                  selectedRoleMenus.has(menu.menuCode)
                                    ? "bg-brand-blue/5 border-brand-blue/30"
                                    : "bg-white border-slate-100 hover:border-slate-200"
                                }`}
                              >
                                <Checkbox
                                  checked={selectedRoleMenus.has(menu.menuCode)}
                                  onChange={() => handleRoleMenuToggle(menu.menuCode)}
                                  id={`menu-${menu.menuCode}`}
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={`menu-${menu.menuCode}`}
                                    className="cursor-pointer"
                                  >
                                    <span className="font-medium text-brand-blue text-sm">
                                      {menu.menuName}
                                    </span>
                                  </Label>
                                  <div className="text-xs text-brand-blue/40 mt-1 font-mono">
                                    {menu.menuCode}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Footer Actions */}
                          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <span className="text-xs text-brand-blue/40">
                              {selectedRoleName && roleMenuData && (
                                <span className="flex items-center gap-2">
                                  <span>Changes affect all users with this role</span>
                                  <Badge variant="outline" className="text-xs">
                                    Updated via security stamp
                                  </Badge>
                                </span>
                              )}
                            </span>
                            <Button
                              onClick={handleSaveRoleMenus}
                              disabled={savingRoleMenus}
                              className="min-w-[180px]"
                            >
                              {savingRoleMenus ? "Saving..." : "Save Role Configuration"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
