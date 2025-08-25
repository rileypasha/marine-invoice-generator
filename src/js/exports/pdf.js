import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePDF() {
  try {
    const invoice = document.querySelector('.invoice-preview');
    
    // Create canvas from HTML with lower scale to fit on one page
    const canvas = await html2canvas(invoice, {
      scale: 1.5,
      logging: false,
      useCORS: true,
      allowTaint: true
    });
    
    // Force fit to single A4 page dimensions
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10; // 10mm margins
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - (margin * 2);
    
    // Calculate dimensions to fit within one page
    const canvasRatio = canvas.width / canvas.height;
    const pageRatio = availableWidth / availableHeight;
    
    let imgWidth, imgHeight;
    
    if (canvasRatio > pageRatio) {
      // Canvas is wider relative to page - constrain by width
      imgWidth = availableWidth;
      imgHeight = availableWidth / canvasRatio;
    } else {
      // Canvas is taller relative to page - constrain by height  
      imgHeight = availableHeight;
      imgWidth = availableHeight * canvasRatio;
    }
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Center the image on the page
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;
    
    // Add image to PDF (forced to fit on one page)
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    
    // Save PDF
    const date = new Date().toISOString().split('T')[0];
    pdf.save(`marine-invoice-${date}.pdf`);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
    return false;
  }
}