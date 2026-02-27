import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, ClipboardList, Loader2, AlertCircle, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UploadPdf: React.FC = () => {
  const navigate = useNavigate();
  const { csrfToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'invoice' | 'estimate'>('invoice');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Please select a PDF or image file (PNG, JPEG)');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    setFile(selectedFile);
    setError(null);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }, [handleFileSelect]);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleParse = async () => {
    if (!file) return;
    setIsParsing(true);
    setError(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/v1/invoice/parse-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        credentials: 'include',
        body: JSON.stringify({
          pdfBase64: base64,
          mimeType: file.type,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || 'Failed to parse PDF. Please try again.');
        return;
      }

      // Navigate to CreateInvoice with pre-populated data
      const targetPath = documentType === 'estimate' ? '/estimates/new' : '/requests/new';
      navigate(targetPath, {
        state: {
          restoredFormState: {
            invoiceData: result.data,
          },
        },
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred while parsing the PDF');
    } finally {
      setIsParsing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload PDF</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a vendor invoice PDF and we'll extract the data into a new invoice or estimate.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        {/* Document Type Selection */}
        <div className="p-6 border-b border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Create as
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDocumentType('invoice')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                documentType === 'invoice'
                  ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-4 w-4" />
              Invoice
            </button>
            <button
              type="button"
              onClick={() => setDocumentType('estimate')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                documentType === 'estimate'
                  ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Estimate
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="p-6">
          {!file ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <Upload className={`h-10 w-10 mx-auto mb-3 ${dragActive ? 'text-[#1E3A5F]' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-700">
                Drag and drop your PDF here, or click to browse
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PDF, PNG, or JPEG up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#1E3A5F]/10 rounded-lg">
                  <FileText className="h-5 w-5 text-[#1E3A5F]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearFile}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                disabled={isParsing}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-6 pb-4">
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Parse Button */}
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={handleParse}
            disabled={!file || isParsing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white text-sm font-medium rounded-lg hover:bg-[#152b47] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing invoice with AI...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Parse & Create {documentType === 'estimate' ? 'Estimate' : 'Invoice'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPdf;
