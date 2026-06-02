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

interface UserMatrixData {
  userId: string
  fullName: string
  email: string
  assignedPlants: string[]
  allPlants: Plant[]
}

export function UserAccessManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [matrixData, setMatrixData] = useState<UserMatrixData | null>(null)
  const [selectedPlants, setSelectedPlants] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const api = useApi()

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/api/admin/uam/users")
        if (!res.ok) {
          throw new Error("Failed to fetch users")
        }
        const data: User[] = await res.json()
        setUsers(data)
      } catch (err) {
        console.error("Failed to fetch users", err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  // Fetch user matrix when a user is selected
  useEffect(() => {
    if (!selectedUserId) {
      setMatrixData(null)
      setSelectedPlants(new Set())
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
      } catch (err) {
        console.error("Failed to fetch user matrix", err)
      } finally {
        setMatrixLoading(false)
      }
    }
    fetchMatrix()
  }, [selectedUserId])

  const handleSave = async () => {
    if (!selectedUserId) return

    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await api.post(`/api/admin/uam/users/${selectedUserId}/matrix`, {
        selectedPlants: Array.from(selectedPlants),
      })
      if (!res.ok) {
        throw new Error("Failed to update user permissions")
      }
      const data = await res.json()
      setSaveMessage(data.message || "User permissions updated successfully")
    } catch (err) {
      console.error("Failed to update user permissions", err)
      setSaveMessage("Failed to update user permissions. Please try again.")
    } finally {
      setSaving(false)
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

  const handleSelectAll = () => {
    if (!matrixData) return
    if (selectedPlants.size === matrixData.allPlants.length) {
      setSelectedPlants(new Set())
    } else {
      setSelectedPlants(new Set(matrixData.allPlants.map((p) => p.plantCode)))
    }
  }

  // Filter users by search query
  const filteredUsers = users.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-blue tracking-tight">
            User Access Management
          </h1>
          <p className="text-sm text-brand-blue/60">
            Manage plant-level data access permissions for internal users
          </p>
        </div>
      </div>

      {/* Save Message Alert */}
      {saveMessage && (
        <Card
          className={`border ${
            saveMessage.includes("failed")
              ? "border-brand-red/20 bg-brand-red/5"
              : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p
              className={`text-sm ${
                saveMessage.includes("failed")
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

      {/* Split Layout */}
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
              <div className="max-h-[500px] overflow-y-auto">
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
                        onClick={() => setSelectedUserId(user.id)}
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

        {/* Right Column - Plant Assignment Matrix */}
        <div className="lg:col-span-2">
          {matrixLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-brand-blue/60">
                Loading plant permissions...
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
                <p>Select a user from the list to manage their plant access</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
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
                  <Badge
                    variant="outline"
                    className="border-brand-blue/20 text-brand-blue/70"
                  >
                    {selectedPlants.size} plant
                    {selectedPlants.size !== 1 ? "s" : ""} assigned
                  </Badge>
                </div>
              </div>

              <div className="p-6">
                {/* Select All Toggle */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={
                        matrixData.allPlants.length > 0 &&
                        selectedPlants.size === matrixData.allPlants.length
                      }
                      onChange={handleSelectAll}
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

                {/* Plant Grid */}
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

                {/* Footer Actions */}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="min-w-[180px]"
                  >
                    {saving ? "Saving..." : "Apply Permissions Matrix"}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
