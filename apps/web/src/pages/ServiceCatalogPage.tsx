import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serviceCatalogApi } from '../api/client';
import { useCurrentOrganizationId } from '../stores/organizationStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ShoppingCart, Clock, CheckCircle, Search, X } from 'lucide-react';
import { ModuleErrorHandler } from '../hooks/useModuleGuard';

export function ServiceCatalogPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const organizationId = useCurrentOrganizationId();

  const { data: services, isLoading, error } = useQuery({
    queryKey: ['services', organizationId, search, selectedCategory],
    queryFn: () =>
      serviceCatalogApi.services.list({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        status: 'active',
      }).then((r) => r.data),
    retry: false,
    enabled: !!organizationId,
  });

  const { data: categories } = useQuery({
    queryKey: ['service-categories', organizationId],
    queryFn: () => serviceCatalogApi.categories.list().then((r) => r.data),
    enabled: !!organizationId,
  });

  return (
    <ModuleErrorHandler error={error} moduleName="Service Catalog">
    <div className="h-full overflow-y-auto space-y-6 pr-2">
      <div>
        <h1 className="text-3xl font-bold">Service Catalog</h1>
        <p className="text-muted-foreground">Browse available services and submit requests</p>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Search Bar - Full Width */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Filter Buttons - Below Search */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories?.map((category: any) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {!search && !selectedCategory && categories && categories.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category: any) => (
            <Card
              key={category.id}
              className="bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-md transition cursor-pointer"
              onClick={() => setSelectedCategory(category.id)}
            >
              <CardHeader>
                <CardTitle>{category.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{category.description}</p>
                <p className="text-sm mt-2">
                  {category._count?.services || 0} services available
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Services */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Services</h2>
        {isLoading ? (
          <div className="animate-pulse grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : services?.items?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No services available</h3>
              <p className="text-muted-foreground">
                Check back later for available services
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {services?.items?.map((service: any) => (
              <Link key={service.id} to={`/service-catalog/${service.slug}`}>
                <Card className="hover:shadow-md transition cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {service.category?.name}
                        </p>
                      </div>
                      {service.price !== null && service.price > 0 && (
                        <span className="text-lg font-bold text-primary">
                          ${service.price}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {service.shortDescription || service.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {service.deliveryTimeDays && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {service.deliveryTimeDays} day(s)
                        </span>
                      )}
                      {service.requiresApproval ? (
                        <span className="flex items-center gap-1">
                          Approval required
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Auto-fulfillment
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
    </ModuleErrorHandler>
  );
}
