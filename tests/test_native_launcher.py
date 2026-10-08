import unittest
from unittest.mock import patch

from scripts import iniciar_local


class NativeLauncherTests(unittest.TestCase):
    def test_dependency_check_does_not_import_heavy_modules(self):
        with patch.object(iniciar_local.importlib.util, 'find_spec', return_value=object()) as probe:
            self.assertEqual(iniciar_local.missing_dependencies(), [])
            self.assertEqual(probe.call_count, 4)

    def test_reports_missing_dependencies(self):
        with patch.object(iniciar_local.importlib.util, 'find_spec', side_effect=[None, object(), None, object()]):
            self.assertEqual(iniciar_local.missing_dependencies(), ['duckdb', 'h3'])

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
