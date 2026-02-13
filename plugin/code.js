// Figma Plugin Code
figma.showUI(__html__, { 
    width: 450, 
    height: 350,
    title: 'Figma Render Connector'
});

// 🔥 UPDATE THIS WITH YOUR RENDER URL AFTER DEPLOYMENT
const BACKEND_URL = 'https://YOUR-RENDER-URL.onrender.com';

// Send initial data to UI
figma.ui.postMessage({
    type: 'init',
    backendUrl: BACKEND_URL,
    selectionCount: figma.currentPage.selection.length
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
        case 'process':
            await processSelection();
            break;
        case 'test':
            await testConnection();
            break;
        case 'close':
            figma.closePlugin();
            break;
    }
};

// Process selected elements
async function processSelection() {
    try {
        const selection = figma.currentPage.selection;
        
        if (selection.length === 0) {
            figma.notify('⚠️ Please select something');
            figma.ui.postMessage({ 
                type: 'error', 
                message: 'No elements selected. Select something in Figma first.' 
            });
            return;
        }

        figma.ui.postMessage({ 
            type: 'status', 
            message: '📤 Sending to backend...' 
        });

        // Extract data from selected nodes
        const nodesData = selection.map(node => ({
            id: node.id,
            name: node.name,
            type: node.type,
            visible: node.visible,
            locked: node.locked
        }));

        // Send to backend
        const response = await fetch(`${BACKEND_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selection: nodesData,
                count: selection.length,
                timestamp: new Date().toISOString(),
                plugin: 'Figma Render Connector v1.0'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        figma.ui.postMessage({
            type: 'success',
            data: result,
            message: '✅ Success!'
        });
        
        figma.notify('✅ Data sent to backend!');
        
    } catch (error) {
        console.error('Error:', error);
        figma.ui.postMessage({
            type: 'error',
            message: error.message || 'Failed to connect to backend'
        });
        figma.notify('❌ Failed to send to backend');
    }
}

// Test backend connection
async function testConnection() {
    figma.ui.postMessage({ 
        type: 'status', 
        message: '🔄 Testing connection...' 
    });
    
    try {
        const response = await fetch(BACKEND_URL);
        const data = await response.json();
        
        figma.ui.postMessage({
            type: 'test_result',
            success: true,
            data: data,
            message: '✅ Connection successful!'
        });
        
        figma.notify('✅ Connected to backend!');
        
    } catch (error) {
        figma.ui.postMessage({
            type: 'test_result',
            success: false,
            message: error.message || 'Cannot connect to backend'
        });
    }
}

// Update selection count when selection changes
figma.on('selectionchange', () => {
    figma.ui.postMessage({
        type: 'selection_update',
        count: figma.currentPage.selection.length
    });
});