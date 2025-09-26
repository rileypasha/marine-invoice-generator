import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Eye, Plus, Ship, ArrowLeft } from 'lucide-react';
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
  const [vesselData, setVesselData] = useState<Vessel>({
    name: '',
    weight: '',
    beam: '',
    id: null
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isWeightFocused, setIsWeightFocused] = useState(false);
  const [isBeamFocused, setIsBeamFocused] = useState(false);

  // Helper function to format value with suffix for display
  const formatWithSuffix = (value: string, suffix: string) => {
    if (!value || value.trim() === '') return '';
    const cleanValue = value.replace(suffix, '').trim();
    return cleanValue ? cleanValue + suffix : '';
  };

  // Helper function to remove suffix for editing
  const stripSuffix = (value: string, suffix: string) => {
    if (!value) return '';
    return value.replace(suffix, '').trim();
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
    setIsLoading(true);
    try {
      // In a real app, this would save to your API
      console.log('Saving vessel:', vesselData);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate('/vessels');
    } catch (error) {
      console.error('Error saving vessel:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndNew = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would save to your API
      console.log('Saving vessel:', vesselData);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear the form for a new vessel
      setVesselData({
        name: '',
        weight: '',
        beam: '',
        id: null
      });

      // Reset focus states
      setIsWeightFocused(false);
      setIsBeamFocused(false);

    } catch (error) {
      console.error('Error saving vessel:', error);
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
            <h1 className="text-3xl font-bold text-gray-900">Create Vessel</h1>
          </div>

          <div className="flex items-center space-x-3">
            <Button onClick={handleSave} disabled={!isFormValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Vessel'}
            </Button>
            <Button onClick={handleSaveAndNew} disabled={!isFormValid || isLoading} className="bg-black text-white hover:bg-gray-800">
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
                        value={isWeightFocused ? stripSuffix(vesselData.weight, ' tons') : formatWithSuffix(vesselData.weight, ' tons')}
                        onChange={(e) => handleNumericInput(e, 'weight')}
                        onFocus={() => setIsWeightFocused(true)}
                        onBlur={() => setIsWeightFocused(false)}
                        disabled={isLoading}
                        className="pr-12"
                      />
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
                        value={isBeamFocused ? stripSuffix(vesselData.beam, ' ft') : formatWithSuffix(vesselData.beam, ' ft')}
                        onChange={(e) => handleNumericInput(e, 'beam')}
                        onFocus={() => setIsBeamFocused(true)}
                        onBlur={() => setIsBeamFocused(false)}
                        disabled={isLoading}
                        className="pr-8"
                      />
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

              {!vesselData.weight && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Weight is required for clearance fee
                </div>
              )}

              {isFormValid && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg border border-green-200">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Vessel information is complete
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