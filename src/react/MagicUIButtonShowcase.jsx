import React from 'react'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Badge } from '../components/ui/badge.jsx'
import { Separator } from '../components/ui/separator.jsx'
import { Heart, Download, Settings, Star, Plus, ArrowRight, Mail, Github, Twitter } from 'lucide-react'

const ButtonShowcase = ({
  title = "Magic UI Button Component Showcase",
  description = "Explore all button variants and sizes with interactive examples from 21st.dev"
}) => {
  const variants = [
    { name: 'Default', value: 'default' },
    { name: 'Destructive', value: 'destructive' },
    { name: 'Outline', value: 'outline' },
    { name: 'Secondary', value: 'secondary' },
    { name: 'Ghost', value: 'ghost' },
    { name: 'Link', value: 'link' }
  ]

  const sizes = [
    { name: 'Small', value: 'sm' },
    { name: 'Default', value: 'default' },
    { name: 'Large', value: 'lg' },
    { name: 'Icon', value: 'icon' }
  ]

  const iconExamples = [
    { icon: Heart, label: 'Like' },
    { icon: Download, label: 'Download' },
    { icon: Settings, label: 'Settings' },
    { icon: Star, label: 'Favorite' },
    { icon: Plus, label: 'Add' },
    { icon: Mail, label: 'Email' }
  ]

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 bg-background">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">{title}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{description}</p>
      </div>

      {/* Variants Showcase */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary">Variants</Badge>
            Button Variants
          </CardTitle>
          <CardDescription>
            Different visual styles for various use cases and contexts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {variants.map((variant) => (
              <div key={variant.value} className="space-y-4 p-4 rounded-lg border border-border bg-card">
                <div className="text-center">
                  <h3 className="font-semibold text-card-foreground mb-2">{variant.name}</h3>
                  <div className="space-y-3">
                    <Button variant={variant.value} className="w-full">
                      {variant.name} Button
                    </Button>
                    <Button variant={variant.value} className="w-full" disabled>
                      Disabled State
                    </Button>
                    <Button variant={variant.value} className="w-full">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      With Icon
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sizes Showcase */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary">Sizes</Badge>
            Button Sizes
          </CardTitle>
          <CardDescription>
            Different sizes to fit various layout requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {sizes.map((size) => (
              <div key={size.value} className="space-y-4">
                <h3 className="font-semibold text-lg text-foreground">{size.name} Size</h3>
                <Separator />
                <div className="flex flex-wrap items-center gap-4">
                  {size.value === 'icon' ? (
                    iconExamples.map((example, index) => {
                      const IconComponent = example.icon
                      return (
                        <div key={index} className="flex flex-col items-center gap-2">
                          <Button variant="outline" size={size.value}>
                            <IconComponent className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground">{example.label}</span>
                        </div>
                      )
                    })
                  ) : (
                    variants.map((variant) => (
                      <Button key={variant.value} variant={variant.value} size={size.value}>
                        {variant.name}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interactive Examples */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary">Examples</Badge>
            Real-world Usage
          </CardTitle>
          <CardDescription>
            Common button patterns and combinations used in applications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Action Groups */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Action Groups</h3>
              <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex gap-2">
                  <Button>Save Changes</Button>
                  <Button variant="outline">Cancel</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive">Delete</Button>
                  <Button variant="ghost">Cancel</Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>
            </div>

            {/* Social Actions */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Social Actions</h3>
              <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Github className="w-4 h-4 mr-2" />
                    GitHub
                  </Button>
                  <Button variant="outline" size="sm">
                    <Twitter className="w-4 h-4 mr-2" />
                    Twitter
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <Heart className="w-4 h-4 mr-2" />
                    Like
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Star className="w-4 h-4 mr-2" />
                    Star
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
                <Button className="w-full">
                  <Mail className="w-4 h-4 mr-2" />
                  Subscribe to Newsletter
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading States */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary">States</Badge>
            Button States
          </CardTitle>
          <CardDescription>
            Different states including loading, disabled, and active states
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Normal State</h4>
              <div className="space-y-2">
                <Button className="w-full">Click Me</Button>
                <Button variant="outline" className="w-full">Outline Button</Button>
                <Button variant="secondary" className="w-full">Secondary</Button>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Disabled State</h4>
              <div className="space-y-2">
                <Button disabled className="w-full">Disabled</Button>
                <Button variant="outline" disabled className="w-full">Disabled Outline</Button>
                <Button variant="secondary" disabled className="w-full">Disabled Secondary</Button>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">With Icons</h4>
              <div className="space-y-2">
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button variant="secondary" className="w-full">
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Indicators */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline">✅ Status</Badge>
            Magic UI Integration Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Real Magic UI components from 21st.dev</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Tailwind v4 with oklch color space</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Proper shadows and focus states</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Dark mode support configured</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Accessibility features enabled</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Responsive design working</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ButtonShowcase