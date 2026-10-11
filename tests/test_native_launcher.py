import unittest
from unittest.mock import patch

from scripts import iniciar_local


class NativeLauncherTests(unittest.TestCase):
    def test_windows_refused_port_starts_native_server(self):
        error = OSError(10061, 'Connection refused')
        with patch.object(iniciar_local.urllib.request, 'urlopen',
                          side_effect=iniciar_local.urllib.error.URLError(error)), \
                patch.object(iniciar_local, 'missing_dependencies', return_value=[]), \
                patch('peru_intel.__main__.main', return_value=0) as cli:
            self.assertEqual(iniciar_local.main(), 0)
            cli.assert_called_once_with(['serve', '--port', '8360', '--open'])

    def test_timeout_does_not_start_another_server(self):
        with patch.object(iniciar_local.urllib.request, 'urlopen',
                          side_effect=iniciar_local.urllib.error.URLError(TimeoutError())), \
                patch.object(iniciar_local, 'missing_dependencies') as dependencies:
            self.assertEqual(iniciar_local.main(), 1)
            dependencies.assert_not_called()

    def test_health_probe_allows_windows_connection_refusal_delay(self):
        from io import BytesIO
        response = BytesIO('{"app":"Mapa Perú Analítico","ok":true}'.encode('utf-8'))
        with patch.object(iniciar_local.urllib.request, 'urlopen', return_value=response) as probe, \
                patch.object(iniciar_local.webbrowser, 'open'):
            self.assertEqual(iniciar_local.main(), 0)
            self.assertGreaterEqual(probe.call_args.kwargs['timeout'], 5)

    def test_dependency_check_does_not_import_heavy_modules(self):
        with patch.object(iniciar_local.importlib.util, 'find_spec', return_value=object()) as probe:
            self.assertEqual(iniciar_local.missing_dependencies(), [])
            self.assertEqual(probe.call_count, 5)

    def test_reports_missing_dependencies(self):
        with patch.object(iniciar_local.importlib.util, 'find_spec', side_effect=[None, object(), None, object(), object()]):
            self.assertEqual(iniciar_local.missing_dependencies(), ['duckdb', 'h3'])

    def test_satellite_dependency_is_installed_when_missing(self):
        with patch.object(iniciar_local.importlib.util, 'find_spec', side_effect=[object(), object(), object(), object(), None]):
            self.assertEqual(iniciar_local.missing_dependencies(), ['rasterio'])

    def test_only_reuses_matching_application(self):
        self.assertTrue(iniciar_local.is_mapa({'app': 'Mapa Perú Analítico', 'ok': True}))
        self.assertFalse(iniciar_local.is_mapa({'ok': True}))
        self.assertFalse(iniciar_local.is_mapa({'app': 'Mapa Perú Analítico', 'ok': False}))

    def test_running_server_opens_browser_without_dependency_install(self):
        from io import BytesIO
        response = BytesIO('{"app":"Mapa Perú Analítico","ok":true}'.encode('utf-8'))
        with patch.object(iniciar_local.urllib.request, 'urlopen', return_value=response), \
                patch.object(iniciar_local.webbrowser, 'open') as browser, \
                patch.object(iniciar_local, 'missing_dependencies') as dependencies:
            self.assertEqual(iniciar_local.main(), 0)
            browser.assert_called_once_with(iniciar_local.URL)
            dependencies.assert_not_called()

    def test_other_service_does_not_open_browser(self):
        from io import BytesIO
        with patch.object(iniciar_local.urllib.request, 'urlopen', return_value=BytesIO(b'{"ok":true}')), \
                patch.object(iniciar_local.webbrowser, 'open') as browser:
            self.assertEqual(iniciar_local.main(), 1)
            browser.assert_not_called()

    def test_invalid_health_response_does_not_try_to_start(self):
        from io import BytesIO
        with patch.object(iniciar_local.urllib.request, 'urlopen', return_value=BytesIO(b'not json')), \
                patch.object(iniciar_local, 'missing_dependencies') as dependencies, \
                patch.object(iniciar_local.webbrowser, 'open') as browser:
            self.assertEqual(iniciar_local.main(), 1)
            dependencies.assert_not_called()
            browser.assert_not_called()
