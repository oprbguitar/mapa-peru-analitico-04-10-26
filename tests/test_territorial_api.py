"""Contracts for territorial integrations and safe provider failure responses."""
import unittest
import urllib.error
from unittest.mock import patch
from peru_intel.backend import api


class TerritorialApiTests(unittest.TestCase):
    def test_imagery_query_contract(self):
        with patch('peru_intel.imagery.service.search_imagery', return_value={'items': []}) as query:
            self.assertEqual(api.route_get('/api/v1/imagery/search', {'bbox': ['-77.1,-12.1,-77,-12']}), {'items': []})
        self.assertEqual(query.call_args.args[0], '-77.1,-12.1,-77,-12')

    def test_flight_list_and_history(self):
        with patch('peru_intel.live.flight_history.list_tracks', return_value={'items': []}), \
             patch('peru_intel.live.flight_history.history', return_value={'available': False}) as query:
            self.assertEqual(api.route_get('/api/v1/flights/history', {}), {'items': []})
            self.assertFalse(api.route_get('/api/v1/flights/history/abc123', {})['available'])
        self.assertEqual(query.call_args.args[0], 'abc123')

    def test_cloud_manifest_and_street(self):
        with patch('peru_intel.weather.clouds.manifest', return_value={'time': 'published'}), \
             patch('peru_intel.live.street_imagery.search', return_value={'status': 'key_required'}):
            self.assertEqual(api.route_get('/api/v1/intel/weather/clouds', {})['time'], 'published')
            self.assertEqual(api.route_get('/api/v1/street/images', {'bbox': ['-77,-12,-76.9,-11.9']})['status'], 'key_required')

    def test_upstream_failure_is_generic_and_bad_input_is_400(self):
        with patch('peru_intel.imagery.service.search_imagery', side_effect=urllib.error.URLError('private detail')):
            with self.assertRaises(api.ApiError) as error:
                api.route_get('/api/v1/imagery/search', {})
            self.assertEqual(error.exception.status, 502)
            self.assertNotIn('private', str(error.exception))
        with self.assertRaises(api.ApiError) as error:
            api.route_get('/api/v1/flights/history/invalid', {})
        self.assertEqual(error.exception.status, 400)

    def test_mapillary_secret_never_returned(self):
        with patch.object(api.config, 'setting', side_effect=lambda name: 'private-token' if name == 'mapillary_token' else ''):
            result = api.route_get('/api/v1/meta/settings', {})
        self.assertTrue(result['secrets']['mapillary_token'])
        self.assertNotIn('private-token', str(result))

    def test_unknown_territorial_route_is_404(self):
        with self.assertRaises(api.ApiError) as error:
            api.route_get('/api/v1/street/not-real', {})
        self.assertEqual(error.exception.status, 404)
