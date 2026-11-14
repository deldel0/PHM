const dashboardComponents = [
    ['app-header', './components/header.html.txt'],
    ['app-sidebar', './components/sidebar.html.txt'],
    ['app-views', './components/views.html.txt'],
    ['app-upload-modal', './components/upload-modal.html.txt'],
    ['app-detail-modal', './components/detail-modal.html.txt'],
    ['app-toast', './components/toast.html.txt']
];

window.DashboardComponentsReady = Promise.all(dashboardComponents.map(async ([targetId, url]) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not load ${url}: HTTP ${response.status}`);
    }

    const target = document.getElementById(targetId);
    if (!target) {
        throw new Error(`Missing component mount point: #${targetId}`);
    }

    target.innerHTML = await response.text();
}));