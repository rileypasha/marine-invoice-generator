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

interface LinkedVessel {
  id: string;
  name: string;
  weight_tons?: string;
  beam_ft?: string;
}

const CreateVessel: React.FC = () => {
  const navigate = useNavigate();
  const [vesselData, setVesselData] = useState<Vessel>({
    name: '',
    weight: '',
    beam: '',
    id: null
  });

  const [showVesselSelector, setShowVesselSelector] = useState(false);
  const [linkedVessel, setLinkedVessel] = useState<LinkedVessel | null>(null);
  const [availableVessels, setAvailableVessels] = useState<LinkedVessel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load available vessels on component mount
  useEffect(() => {
    // In a real app, this would fetch from your API
    // For now, we'll use mock data
    setAvailableVessels([
      { id: '1', name: 'SS Marine Explorer', weight_tons: '450', beam_ft: '32' },
      { id: '2', name: 'Ocean Star', weight_tons: '680', beam_ft: '42' },
      { id: '3', name: 'Harbor Queen', weight_tons: '320', beam_ft: '28' },
      { id: '4', name: 'Pacific Voyager', weight_tons: '750', beam_ft: '45' }
    ]);
  }, []);

  const handleInputChange = (field: keyof Vessel, value: string) => {
    setVesselData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVesselLink = (vesselId: string) => {
    const vessel = availableVessels.find(v => v.id === vesselId);
    if (vessel) {
      setLinkedVessel(vessel);
      // Auto-fill vessel data from linked vessel
      setVesselData(prev => ({
        ...prev,
        name: vessel.name,
        weight: vessel.weight_tons || '',
        beam: vessel.beam_ft || ''
      }));
    }
    setShowVesselSelector(false);
  };

  const handleVesselUnlink = () => {
    setLinkedVessel(null);
    // Clear auto-filled data
    setVesselData(prev => ({
      ...prev,
      name: '',
      weight: '',
      beam: ''
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

  const handlePreview = () => {
    console.log('Preview vessel:', vesselData);
  };

  const handleNew = () => {
    setVesselData({
      name: '',
      weight: '',
      beam: '',
      id: null
    });
    setLinkedVessel(null);
  };

  const isFormValid = vesselData.name.trim() !== '';
  const weightValue = parseFloat(vesselData.weight);
  const isOverWeight = weightValue > 500;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/vessels')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Vessels
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Vessel</h1>
              <p className="text-gray-600">Add a new vessel to your fleet database</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={handlePreview} disabled={!isFormValid}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Vessel'}
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
                Vessel Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Vessel Selector Section */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium">Link to Existing Vessel</h4>
                    <p className="text-xs text-muted-foreground">
                      Auto-fill details from your vessel database
                    </p>
                  </div>
                  {linkedVessel ? (
                    <Badge variant="secondary" className="text-xs">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Linked to {linkedVessel.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Not linked
                    </Badge>
                  )}
                </div>

                {linkedVessel ? (
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{linkedVessel.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {linkedVessel.weight_tons && `${linkedVessel.weight_tons} tons`}
                        {linkedVessel.weight_tons && linkedVessel.beam_ft && ' • '}
                        {linkedVessel.beam_ft && `${linkedVessel.beam_ft} ft beam`}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleVesselUnlink}
                    >
                      Unlink
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {showVesselSelector ? (
                      <div className="space-y-2">
                        <Select onValueChange={handleVesselLink}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a vessel to link..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableVessels.map((vessel) => (
                              <SelectItem key={vessel.id} value={vessel.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{vessel.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {vessel.weight_tons && `${vessel.weight_tons} tons`}
                                    {vessel.weight_tons && vessel.beam_ft && ' • '}
                                    {vessel.beam_ft && `${vessel.beam_ft} ft`}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowVesselSelector(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVesselSelector(true)}
                        disabled={isLoading || availableVessels.length === 0}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Link Existing Vessel
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Vessel Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vessel Name */}
                <div className="md:col-span-3 space-y-2">
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

                {/* Vessel Weight */}
                <div className="space-y-2">
                  <Label htmlFor="vessel-weight">Weight (Tons)</Label>
                  <div className="relative">
                    <Input
                      id="vessel-weight"
                      type="text"
                      placeholder="0.0"
                      value={vesselData.weight}
                      onChange={(e) => handleNumericInput(e, 'weight')}
                      disabled={isLoading}
                      className="pr-12"
                    />
                    {vesselData.weight && (
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="text-sm text-muted-foreground">tons</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for clearance fee calculation
                  </p>
                </div>

                {/* Vessel Beam */}
                <div className="space-y-2">
                  <Label htmlFor="vessel-beam">Beam (Feet)</Label>
                  <div className="relative">
                    <Input
                      id="vessel-beam"
                      type="text"
                      placeholder="0.0"
                      value={vesselData.beam}
                      onChange={(e) => handleNumericInput(e, 'beam')}
                      disabled={isLoading}
                      className="pr-8"
                    />
                    {vesselData.beam && (
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="text-sm text-muted-foreground">ft</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Weight Category Indicator */}
                <div className="space-y-2">
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
                  <p className="text-xs text-muted-foreground">
                    {vesselData.weight && isOverWeight
                      ? 'Higher clearance fee will apply'
                      : 'Standard clearance fee will apply'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Form Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!vesselData.name && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Vessel name is required to proceed
                </div>
              )}

              {isFormValid && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Vessel information is complete
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vessel Summary */}
          {isFormValid && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vessel Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <div className="font-medium">{vesselData.name}</div>
                  <div className="text-muted-foreground">
                    {vesselData.weight && `${vesselData.weight} tons`}
                    {vesselData.weight && vesselData.beam && ' • '}
                    {vesselData.beam && `${vesselData.beam} ft beam`}
                  </div>
                </div>

                {vesselData.weight && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Clearance Category</div>
                    <Badge
                      variant={isOverWeight ? "destructive" : "secondary"}
                      className="text-xs mt-1"
                    >
                      {isOverWeight ? 'Heavy Vessel (>500 tons)' : 'Standard Vessel (≤500 tons)'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => navigate('/vessels')}>
                View All Vessels
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/invoices/create')}>
                Create Invoice for Vessel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateVessel;