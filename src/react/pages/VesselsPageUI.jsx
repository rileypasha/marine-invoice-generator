import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input
} from '../components/index.js';

const VesselsPageUI = ({
  vessels = [],
  onEdit,
  onDelete,
  onToggleStatus,
  onAddNew,
  onSearch,
  searchQuery = '',
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  totalVessels = 0,
  pageSize = 25,
  onPageChange
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVessel, setEditingVessel] = useState(null);

  const handleEdit = (vessel) => {
    setEditingVessel(vessel);
    setModalOpen(true);
    onEdit?.(vessel);
  };

  const handleAddNew = () => {
    setEditingVessel(null);
    setModalOpen(true);
    onAddNew?.();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingVessel(null);
  };

  const showingStart = (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, totalVessels);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Vessel Directory</CardTitle>
                <CardDescription>
                  Manage your vessel database with search, pagination, and CRUD operations
                </CardDescription>
              </div>
              <Button onClick={handleAddNew}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Vessel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-sm">
                <Input
                  placeholder="Search vessels by name, registration, or home port..."
                  value={searchQuery}
                  onChange={(e) => onSearch?.(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onSearch?.('')}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vessels Table */}
        <Card>
          <CardHeader>
            <CardTitle>Vessels ({totalVessels})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading vessels...</div>
              </div>
            ) : vessels.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <div className="text-muted-foreground mb-4">No vessels found</div>
                <Button onClick={handleAddNew}>Add Your First Vessel</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Length (ft)</TableHead>
                    <TableHead>Weight (tons)</TableHead>
                    <TableHead>Home Port</TableHead>
                    <TableHead>Invoices</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vessels.map((vessel) => (
                    <TableRow key={vessel.id || vessel.name}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{vessel.name}</div>
                          {vessel.registration_number && (
                            <div className="text-sm text-muted-foreground">{vessel.registration_number}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {vessel.registration_number || '-'}
                      </TableCell>
                      <TableCell>
                        {vessel.length_ft ? `${vessel.length_ft} ft` : '-'}
                      </TableCell>
                      <TableCell>
                        {vessel.weight_tons ? `${vessel.weight_tons} tons` : '-'}
                      </TableCell>
                      <TableCell>
                        {vessel.home_port || '-'}
                      </TableCell>
                      <TableCell>
                        {vessel._count?.invoices || 0} invoices
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vessel.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {vessel.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(vessel)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={vessel.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => onToggleStatus?.(vessel.id, vessel.is_active)}
                          >
                            {vessel.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalVessels > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {showingStart} to {showingEnd} of {totalVessels} vessels
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange?.(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => onPageChange?.(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange?.(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vessel Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{editingVessel ? 'Edit Vessel' : 'Add Vessel'}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleCloseModal}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                    </div>

                    <div>
                      <label htmlFor="vessel-name" className="block text-sm font-medium mb-1">
                        Vessel Name *
                      </label>
                      <Input
                        id="vessel-name"
                        name="name"
                        required
                        defaultValue={editingVessel?.name || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-registration" className="block text-sm font-medium mb-1">
                        Registration Number
                      </label>
                      <Input
                        id="vessel-registration"
                        name="registration_number"
                        defaultValue={editingVessel?.registration_number || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-mmsi" className="block text-sm font-medium mb-1">
                        MMSI
                      </label>
                      <Input
                        id="vessel-mmsi"
                        name="mmsi"
                        pattern="[0-9]{9}"
                        maxLength="9"
                        placeholder="9 digits"
                        defaultValue={editingVessel?.mmsi || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-imo" className="block text-sm font-medium mb-1">
                        IMO
                      </label>
                      <Input
                        id="vessel-imo"
                        name="imo"
                        pattern="[0-9]{7}"
                        maxLength="7"
                        placeholder="7 digits"
                        defaultValue={editingVessel?.imo || ''}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-lg font-medium mb-4 mt-6">Dimensions</h3>
                    </div>

                    <div>
                      <label htmlFor="vessel-length" className="block text-sm font-medium mb-1">
                        Length (ft)
                      </label>
                      <Input
                        id="vessel-length"
                        name="length_ft"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={editingVessel?.length_ft || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-beam" className="block text-sm font-medium mb-1">
                        Beam (ft)
                      </label>
                      <Input
                        id="vessel-beam"
                        name="beam_ft"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={editingVessel?.beam_ft || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-draft" className="block text-sm font-medium mb-1">
                        Draft (ft)
                      </label>
                      <Input
                        id="vessel-draft"
                        name="draft_ft"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={editingVessel?.draft_ft || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-weight" className="block text-sm font-medium mb-1">
                        Weight (tons)
                      </label>
                      <Input
                        id="vessel-weight"
                        name="weight_tons"
                        type="number"
                        min="0"
                        step="0.1"
                        defaultValue={editingVessel?.weight_tons || ''}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <h3 className="text-lg font-medium mb-4 mt-6">Location & Owner</h3>
                    </div>

                    <div>
                      <label htmlFor="vessel-home-port" className="block text-sm font-medium mb-1">
                        Home Port
                      </label>
                      <Input
                        id="vessel-home-port"
                        name="home_port"
                        defaultValue={editingVessel?.home_port || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-owner-name" className="block text-sm font-medium mb-1">
                        Owner Name
                      </label>
                      <Input
                        id="vessel-owner-name"
                        name="owner_name"
                        defaultValue={editingVessel?.owner_name || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-owner-email" className="block text-sm font-medium mb-1">
                        Owner Email
                      </label>
                      <Input
                        id="vessel-owner-email"
                        name="owner_email"
                        type="email"
                        defaultValue={editingVessel?.owner_email || ''}
                      />
                    </div>

                    <div>
                      <label htmlFor="vessel-owner-phone" className="block text-sm font-medium mb-1">
                        Owner Phone
                      </label>
                      <Input
                        id="vessel-owner-phone"
                        name="owner_phone"
                        type="tel"
                        defaultValue={editingVessel?.owner_phone || ''}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="vessel-notes" className="block text-sm font-medium mb-1">
                        Notes
                      </label>
                      <Input
                        id="vessel-notes"
                        name="notes"
                        defaultValue={editingVessel?.notes || ''}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={handleCloseModal}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Save Vessel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
};

export default VesselsPageUI;