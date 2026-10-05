module.exports = (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // If requested by the in-app background downloader inside the React Native app:
  if (userAgent.includes('TPS-App-Updater') || userAgent.includes('okhttp') || userAgent.includes('ExpoFileSystem')) {
    // Return a tiny 50-byte response so the old app's built-in fallback triggers Linking.openURL()
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Length', '14');
    return res.status(200).send('TPS_FALLBACK_OK');
  }

  // If opened in a web browser (Chrome, Samsung Internet, etc.):
  // Redirect directly to the full universal release APK package
  res.writeHead(302, {
    Location: 'https://tapowan-whatsapp-gateway.onrender.com/TPS-Original-App.apk',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  return res.end();
};
