import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePDF() {
  try {
    const invoice = document.querySelector('.invoice-preview');
    
    // Create canvas from HTML
    const canvas = await html2canvas(invoice, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true
    });
    
    // Calculate dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;
    
    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
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