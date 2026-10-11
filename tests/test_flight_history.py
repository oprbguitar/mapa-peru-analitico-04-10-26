import json
import io
import sqlite3
import unittest
from unittest.mock import patch

from peru_intel.live import flight_history, street_imagery


class FlightHistoryTests(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(':memory:')
        self.con.row_factory = sqlite3.Row
        self.con.execute('CREATE TABLE aircraft_tracks(hex TEXT, t INTEGER, lat REAL, lon REAL, alt REAL)')
        self.con.executemany('INSERT INTO aircraft_tracks VALUES (?,?,?,?,?)', [
            ('abc123', 1000, -12, -77, 10000), ('abc123', 1100, -12.1, -77.1, 0),
            ('abc123', 1600, -12.2, -77.2, 12000)])

    def tearDown(self):
        self.con.close()

    def test_history_units_and_gaps(self):
        with patch.object(flight_history.sqlite_store, 'connect', return_value=self.con):
            result = flight_history.history('ABC123', 900, 1700)
        self.assertEqual(result['points'][0]['altitude_m'], 3048)
        self.assertIsNone(result['points'][1]['altitude_m'])
        self.assertTrue(result['points'][2]['gap_before'])
        self.assertEqual(result['provenance']['timestamp_semantics'], 'received_at')

    def test_invalid_queries(self):
        for hexa, start, end in [('abc;drop', 900, 1700), ('abc123', 1700, 900),
                                  ('abc123', 0, 604801), ('abc123', float('nan'), 1000)]:
            with self.assertRaises(ValueError):
                flight_history.history(hexa, start, end)

    def test_empty_history_is_explicit(self):
        with patch.object(flight_history.sqlite_store, 'connect', return_value=self.con):
            result = flight_history.history('def123', 900, 1700)
        self.assertFalse(result['available'])
        self.assertIn('no dispone', result['note'])

    def test_list_tracks(self):
        with patch.object(flight_history.sqlite_store, 'connect', return_value=self.con):
            result = flight_history.list_tracks(900, 1700)
        self.assertEqual(result['items'][0]['hex'], 'abc123')
        self.assertEqual(result['items'][0]['count'], 3)


class StreetImageryTests(unittest.TestCase):
    def test_missing_key_and_invalid_bbox(self):
        with patch.object(street_imagery.config, 'setting', return_value=''):
            self.assertEqual(street_imagery.search('-77.1,-12.1,-77,-12')['status'], 'key_required')
        for bbox in ['-180,-90,180,90', 'a,b,c,d', '-77,-12,-78,-13']:
            with self.assertRaises(ValueError):
                street_imagery.search(bbox)

    def test_metadata_has_capture_date_and_proxy_url(self):
        payload = json.dumps({'data': [{'id': '123', 'captured_at': 1600000000000,
            'computed_geometry': {'type': 'Point', 'coordinates': [-77.05, -12.05]}}]}).encode()
        with patch.object(street_imagery.config, 'setting', return_value='private'), \
             patch.object(street_imagery, 'http_get', return_value=payload):
            result = street_imagery.search('-77.1,-12.1,-77,-12')
        item = result['items'][0]
        self.assertEqual(item['captured_at'], '2020-09-13T12:26:40+00:00')
        self.assertEqual(item['thumbnail'], '/api/v1/street/image/123')
        self.assertNotIn('private', json.dumps(result))

    def test_thumbnail_rejects_untrusted_host(self):
        for url in ['https://localhost/secret', 'https://fbcdn.net.evil.test/photo',
                    'http://scontent.fbcdn.net/photo', 'https://user@scontent.fbcdn.net/photo',
                    'https://scontent.fbcdn.net:444/photo']:
            payload = json.dumps({'thumb_1024_url': url}).encode()
            with self.subTest(url=url), patch.object(street_imagery.config, 'setting', return_value='private'), \
                 patch.object(street_imagery, 'http_get', return_value=payload):
                with self.assertRaises(ValueError):
                    street_imagery.thumbnail('123')

    def test_graph_auth_does_not_put_token_in_url(self):
        with patch.object(street_imagery.config, 'setting', return_value='sensitive'), \
             patch.object(street_imagery, 'http_get', return_value=b'{"data": []}') as fetch:
            street_imagery.search('-77.1,-12.1,-77,-12')
        args, kwargs = fetch.call_args
        self.assertNotIn('sensitive', args[0])
        self.assertEqual(kwargs['headers']['Authorization'], 'OAuth sensitive')
        self.assertEqual(kwargs['retries'], 1)

    def test_invalid_thumbnail_ids(self):
        for image_id in ['https://evil.test', '123/../../../', '', 'a123']:
            with self.assertRaises(ValueError):
                street_imagery.thumbnail(image_id)

    def test_thumbnail_sniffs_images_and_bounds_size(self):
        metadata = json.dumps({'thumb_1024_url': 'https://scontent.example.fbcdn.net/photo.jpg'}).encode()
        for content, expected in [(b'\xff\xd8\xffdata', 'image/jpeg'),
                                  (b'\x89PNG\r\n\x1a\ndata', 'image/png'),
                                  (b'RIFF0000WEBPdata', 'image/webp'),
                                  (b'<html>error</html>', None), (b'x' * 5_000_001, None)]:
            with self.subTest(expected=expected), \
                 patch.object(street_imagery.config, 'setting', return_value='private'), \
                 patch.object(street_imagery, 'http_get', return_value=metadata), \
                 patch.object(street_imagery.urllib.request, 'build_opener') as opener:
                opener.return_value.open.return_value = io.BytesIO(content)
                if expected:
                    data, mime = street_imagery.thumbnail('123')
                    self.assertEqual(mime, expected)
                    self.assertEqual(data, content)
                    handler = opener.call_args.args[0]()
                    with self.assertRaises(ValueError):
                        handler.redirect_request(None, None, 302, '', {}, 'http://127.0.0.1/private')
                else:
                    with self.assertRaises(ValueError):
                        street_imagery.thumbnail('123')


if __name__ == '__main__':
    unittest.main()
