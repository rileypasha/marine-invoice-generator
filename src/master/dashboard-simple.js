// Simple modal display function for testing
function simpleShowModal(invoice) {
    console.log('🎯 SIMPLE MODAL SHOW');
    
    const modal = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalBody) {
        console.error('Elements not found');
        return;
    }
    
    // Build simple HTML
    const html = `
        <div style="color: white; background: #333; padding: 20px; min-height: 400px;">
            <h2 style="color: white;">Invoice Details</h2>
            <p style="color: white;">ID: ${invoice.id || 'N/A'}</p>
            <p style="color: white;">Vessel: ${invoice.vesselName || 'N/A'}</p>
            <p style="color: white;">Customer: ${invoice.customerName || 'N/A'}</p>
            <p style="color: white;">Total: $${invoice.total || 0}</p>
            <p style="color: white;">Status: ${invoice.status || 'N/A'}</p>
            <button onclick="document.getElementById('detailModal').style.display='none'" style="background: #4a9eff; color: white; padding: 10px 20px; border: none; cursor: pointer;">Close</button>
        </div>
    `;
    
    // Set content
    modalBody.innerHTML = html;
    
    // Show modal
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '9999';
    
    console.log('✅ Simple modal displayed');
}

// Make it globally available
window.simpleShowModal = simpleShowModal;
console.log('💡 Use simpleShowModal(invoice) to test modal display');