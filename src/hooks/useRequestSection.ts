import { useLocation } from 'react-router-dom';

export function useRequestSection() {
  const location = useLocation();
  const isEstimate = location.pathname.startsWith('/estimates');
  const basePath = isEstimate ? '/estimates' : '/requests';
  const documentTypeParam = isEstimate ? 'estimate' : 'invoice';

  return {
    isEstimate,
    basePath,
    documentTypeParam,
    singularLabel: isEstimate ? 'Estimate' : 'Invoice',
    pluralLabel: isEstimate ? 'Estimates' : 'Invoices',
    sectionLabel: isEstimate ? 'Estimates' : 'Requests',
    toList: () => basePath,
    toNew: () => `${basePath}/new`,
    toEdit: (id: string) => `${basePath}/${id}/edit`,
    toView: (id: string) => `${basePath}/${id}`,
    toPreview: () => `${basePath}/preview`,
  };
}
