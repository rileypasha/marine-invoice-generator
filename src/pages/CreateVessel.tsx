import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Eye, Plus, Ship, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS } from '../config/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Vessel {
  id?: string | null;
  name: string;
  weight: string;
  beam: string;
}


const CreateVessel: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { csrfToken, isAuthenticated, currentUser } = useAuth();
  const [vesselData, setVesselData] = useState<Vessel>({
    name: '',
    weight: '',
    beam: '',
    id: null
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);


  // Fetch vessel data when in edit mode
  useEffect(() => {
    if (isEditMode && id && isAuthenticated && csrfToken) {
      fetchVesselData(id);
    }
  }, [id, isEditMode, isAuthenticated, csrfToken]);

  const fetchVesselData = async (vesselId: string) => {
    setIsLoadingData(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.VESSELS}/${vesselId}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Map backend snake_case to frontend camelCase
        setVesselData({
          id: data.vessel.id,
          name: data.vessel.name || '',
          weight: data.vessel.weight_tons?.toString() || '',
          beam: data.vessel.length_ft?.toString() || '',
        });
      } else {
        console.error('Failed to fetch vessel data');
        alert('Failed to load vessel data');
      }
    } catch (error) {
      console.error('Error fetching vessel:', error);
      alert('Error loading vessel data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleInputChange = (field: keyof Vessel, value: string) => {
    setVesselData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  // Validate numeric inputs
  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'weight' | 'beam') => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    const numericValue = value.replace(/[^\d.]/g, '');

    // Ensure only one decimal point
    const parts = numericValue.split('.');
    const cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;

    handleInputChange(field, cleanValue);
  };

  const handleSave = async () => {
    if (!isAuthenticated || !csrfToken) {
      console.error('Not authenticated');
      return;
    }

    setIsLoading(true);
    try {
      // Map frontend fields to backend expected fields (camelCase for validation)
      const vesselPayload = {
        userId: currentUser?.id,
        name: vesselData.name.trim(),
        lengthFt: vesselData.beam ? parseFloat(vesselData.beam) : null,
        weightTons: vesselData.weight ? parseFloat(vesselData.weight) : null,
      };

      const method = isEditMode ? 'PUT' : 'POST';
      const url = isEditMode ? `${API_ENDPOINTS.VESSELS}/${id}` : API_ENDPOINTS.VESSELS;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify(vesselPayload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Vessel saved successfully:', data.vessel);
        navigate('/vessels');
      } else {
        const error = await response.json();
        console.error('Failed to save vessel:', error);

        // Handle different error response formats
        let errorMessage = 'Failed to save vessel. Please try again.';
        if (error.errors && error.errors.length > 0) {
          // Field-level validation errors
          const fieldErrors = error.errors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
          errorMessage = `Validation errors: ${fieldErrors}`;
        } else if (error.error) {
          // Single error message from backend
          errorMessage = error.error;
        } else if (error.message) {
          // General error message
          errorMessage = error.message;
        }

        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error saving vessel:', error);
      alert('Error saving vessel. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    if (!isAuthenticated || !csrfToken) {
      console.error('Not authenticated');
      return;
    }

    setIsLoading(true);
    try {
      // Map frontend fields to backend expected fields (camelCase for validation)
      const vesselPayload = {
        userId: currentUser?.id,
        name: vesselData.name.trim(),
        lengthFt: vesselData.beam ? parseFloat(vesselData.beam) : null,
        weightTons: vesselData.weight ? parseFloat(vesselData.weight) : null,
      };

      const method = isEditMode ? 'PUT' : 'POST';
      const url = isEditMode ? `${API_ENDPOINTS.VESSELS}/${id}` : API_ENDPOINTS.VESSELS;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify(vesselPayload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Vessel saved successfully:', data.vessel);

        // Clear the form for a new vessel
        setVesselData({
          name: '',
          weight: '',
          beam: '',
          id: null
        });

      } else {
        const error = await response.json();
        console.error('Failed to save vessel:', error);

        // Handle different error response formats
        let errorMessage = 'Failed to save vessel. Please try again.';
        if (error.errors && error.errors.length > 0) {
          // Field-level validation errors
          const fieldErrors = error.errors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
          errorMessage = `Validation errors: ${fieldErrors}`;
        } else if (error.error) {
          // Single error message from backend
          errorMessage = error.error;
        } else if (error.message) {
          // General error message
          errorMessage = error.message;
        }

        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error saving vessel:', error);
      alert('Error saving vessel. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleNew = () => {
    setVesselData({
      name: '',
      weight: '',
      beam: '',
      id: null
    });
  };

  const isFormValid = vesselData.name.trim() !== '';
  const weightValue = parseFloat(vesselData.weight);
  const isOverWeight = weightValue > 500;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="relative flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/vessels')}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vessels
          </Button>

          <div className="flex-1 flex justify-center">
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit Vessel' : 'Create Vessel'}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Button onClick={handleSave} disabled={!isFormValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Vessel'}
            </Button>
            <Button onClick={handleSaveAndNew} disabled={!isFormValid || isLoading} className="bg-[#1E3A5F] text-white hover:bg-[#152b47]">
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save & New'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vessel Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ship className="h-5 w-5 mr-2" />
                Vessel Directory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3" style={{ paddingRight: 0 }}>
              {/* Vessel Details Form */}
              <div className="space-y-3">
                {/* Vessel Name */}
                <div className="space-y-2 max-w-[95%]">
                  <Label htmlFor="vessel-name">Vessel Name *</Label>
                  <Input
                    id="vessel-name"
                    type="text"
                    placeholder="Enter vessel name"
                    value={vesselData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={isLoading}
                    className="w-full"
                    required
                  />
                </div>

                {/* Weight, Length, and Clearance Category Row */}
                <div className="flex flex-col md:flex-row md:gap-10">
                  {/* Vessel Weight */}
                  <div className="flex-[1] space-y-2">
                    <Label htmlFor="vessel-weight">Weight</Label>
                    <div className="relative">
                      <Input
                        id="vessel-weight"
                        type="text"
                        placeholder=""
                        value={vesselData.weight}
                        onChange={(e) => handleNumericInput(e, 'weight')}
                        disabled={isLoading}
                        className="pr-16"
                        aria-label="Vessel weight in tons"
                      />
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none"
                        aria-hidden="true"
                      >
                        tons
                      </span>
                    </div>
                  </div>

                  {/* Vessel Length */}
                  <div className="flex-[1] space-y-2">
                    <Label htmlFor="vessel-beam">Length</Label>
                    <div className="relative">
                      <Input
                        id="vessel-beam"
                        type="text"
                        placeholder=""
                        value={vesselData.beam}
                        onChange={(e) => handleNumericInput(e, 'beam')}
                        disabled={isLoading}
                        className="pr-16"
                        aria-label="Vessel length in feet"
                      />
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none"
                        aria-hidden="true"
                      >
                        ft
                      </span>
                    </div>
                  </div>

                  {/* Weight Category Indicator */}
                  <div className="flex-[2] space-y-2">
                    <Label>Clearance Category</Label>
                    <div className="flex items-center space-x-2">
                      {vesselData.weight && parseFloat(vesselData.weight) > 0 ? (
                        <Badge
                          variant={isOverWeight ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {isOverWeight ? 'Over 500 tons' : 'Under 500 tons'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          No weight specified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          {/* Form Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!vesselData.name && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Vessel name is required to proceed
                </div>
              )}

              {vesselData.name && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg border border-green-200">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Vessel name is complete
                </div>
              )}

              {!vesselData.weight && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Weight is required for clearance fee
                </div>
              )}

              {vesselData.weight && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg border border-green-200">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Weight information is complete
                </div>
              )}

            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default CreateVessel;
