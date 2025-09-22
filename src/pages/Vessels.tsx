import React from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '../components/magic/index';

interface Vessel {
  id: string;
  name?: string;
  type?: string;
  imo_number?: string;
  flag?: string;
  owner?: string;
}

interface VesselsProps {
  vessels?: Vessel[];
  onEdit?: (vessel: Vessel) => void;
  onDelete?: (vessel: Vessel) => void;
  onAddNew?: () => void;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  isLoading?: boolean;
}

const Vessels: React.FC<VesselsProps> = ({
  vessels = [],
  onEdit,
  onDelete,
  onAddNew,
  onSearch,
  searchQuery = '',
  isLoading = false
}) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <CardTitle>Vessel Management</CardTitle>
          <CardDescription>
            Manage vessel information and service records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search vessels..."
                value={searchQuery}
                onChange={(e) => onSearch?.(e.target.value)}
                className="w-full"
              />
            </div>
            <Button onClick={() => navigate('/vessels/create')}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
              </svg>
              Add Vessel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vessels Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Vessels</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading vessels...</div>
            </div>
          ) : vessels.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H4a2 2 0 00-2 2v6a2 2 0 002 2h4m0-10h8a2 2 0 012 2v6a2 2 0 01-2 2H8m0-10V4a2 2 0 012-2h4a2 2 0 012 2v3M8 17v3a2 2 0 002 2h4a2 2 0 002-2v-3" />
              </svg>
              <div className="text-muted-foreground mb-4">No vessels found</div>
              <Button onClick={() => navigate('/vessels/create')}>Add Your First Vessel</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IMO Number</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vessels.map((vessel) => (
                  <TableRow key={vessel.id}>
                    <TableCell className="font-medium">
                      {vessel.name || '-'}
                    </TableCell>
                    <TableCell>{vessel.type || '-'}</TableCell>
                    <TableCell>{vessel.imo_number || '-'}</TableCell>
                    <TableCell>{vessel.flag || '-'}</TableCell>
                    <TableCell>{vessel.owner || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit?.(vessel)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete?.(vessel)}
                        >
                          Delete
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
    </div>
  );
};

export default Vessels;