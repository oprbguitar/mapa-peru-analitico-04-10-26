import unittest
from datetime import datetime, timezone
from peru_intel.weather.clouds import parse_capabilities, tile_url

XML = '''<WMS_Capabilities><Capability><Layer><Layer><Name>global_longwave_imagery_mosaic</Name><Dimension name="time" default="2026-10-11T12:00:00Z">2026-10-11T11:00:00Z,2026-10-11T12:00:00Z</Dimension></Layer></Layer></Capability></WMS_Capabilities>'''
class CloudTests(unittest.TestCase):
    def test_latest_explicit_observation(self):
        self.assertEqual(parse_capabilities(XML, datetime(2026,10,11,13,tzinfo=timezone.utc))[-1], '2026-10-11T12:00:00Z')
    def test_reject_intervals_entities_and_future(self):
        for xml in [XML.replace('2026-10-11T11:00:00Z,', '2026-10-11T10:00:00Z/'), '<!DOCTYPE x>'+XML, XML.replace('2026-10-11', '2027-10-11')]:
            with self.assertRaises(ValueError): parse_capabilities(xml, datetime(2026,10,11,13,tzinfo=timezone.utc))
    def test_tile_bounds_and_validation(self):
        self.assertIn('WIDTH=256', tile_url(0,0,0,'2026-10-11T12:00:00Z'))
        for args in [(-1,0,0),(2,4,0),(2,0,4),(12,0,0)]:
            with self.assertRaises(ValueError): tile_url(*args,'2026-10-11T12:00:00Z')
    def test_milliseconds_default_is_equivalent(self):
        xml = XML.replace('2026-10-11T11:00:00Z,2026-10-11T12:00:00Z</', '2026-10-11T11:00:00.000Z,2026-10-11T12:00:00.000Z</')
        self.assertEqual(len(parse_capabilities(xml, datetime(2026,10,11,13,tzinfo=timezone.utc))), 2)
    def test_expired_missing_dimension_and_missing_layer(self):
        for xml in [XML, XML.replace('name="time"','name="height"'), XML.replace('global_longwave_imagery_mosaic','unknown')]:
            with self.assertRaises(ValueError): parse_capabilities(xml, datetime(2026,10,13,13,tzinfo=timezone.utc))
    def test_proxy_only_published_times_and_png(self):
        from unittest.mock import patch
        from peru_intel.weather import clouds
        with patch.object(clouds, 'manifest', return_value={'time':'2026-10-11T12:00:00Z','times':['2026-10-11T12:00:00Z']}), patch.object(clouds, 'http_get', return_value=b'\x89PNG\r\n\x1a\ncontent'):
            self.assertTrue(clouds.tile(0,0,0).startswith(b'\x89PNG'))
            with self.assertRaises(ValueError): clouds.tile(0,0,0,'2026-10-11T11:00:00Z')
        with patch.object(clouds, 'manifest', return_value={'time':'2026-10-11T12:00:00Z','times':['2026-10-11T12:00:00Z']}), patch.object(clouds, 'http_get', return_value=b'<Exception/>'):
            with self.assertRaises(ValueError): clouds.tile(0,0,0)
