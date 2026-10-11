import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from peru_intel.imagery import service


class ImageryTests(unittest.TestCase):
    def test_bbox_validation(self):
        for bbox in ('nan,-12,-77,-11', '-180,-90,180,90', '-77,-12,-78,-11'):
            with self.assertRaises(ValueError):
                service.validate_aoi(bbox)

    def test_polygon_is_preserved(self):
        geometry = {'type': 'Polygon', 'coordinates': [[[-77.1, -12.1], [-77, -12.1], [-77, -12], [-77.1, -12.1]]]}
        bbox, actual = service.validate_aoi(None, geometry)
        self.assertEqual(actual, geometry)
        self.assertEqual(bbox, [-77.1, -12.1, -77.0, -12.0])

    def test_search_retains_acquisition_not_created_date(self):
        feature = {'id': 'S2B_18LTM_20261009_1_L2A', 'bbox': [-77.5,-12.5,-76.5,-11.5],
                   'properties': {'datetime': '2026-10-09T15:36:30Z', 'created': '2026-10-10', 'eo:cloud_cover': 4.5},
                   'assets': {'visual': {'href': 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/test/TCI.tif', 'gsd': 10}}}
        with patch.object(service, '_json', return_value={'features': [feature]}) as request:
            data = service.search_imagery('-77.1,-12.1,-77,-12', start='2026-10-01', end='2026-10-11')
        self.assertEqual(data['items'][0]['acquired_at'], '2026-10-09T15:36:30Z')
        self.assertEqual(data['items'][0]['resolution_m'], 10)
        self.assertIn('bbox', request.call_args.args[1])

    def test_untrusted_asset_rejected(self):
        with self.assertRaises(ValueError):
            service.visual_asset({'assets': {'visual': {'href': 'http://127.0.0.1/a'}}})

    def test_cloud_and_dates_validation(self):
        for args in ({'cloud': -1}, {'cloud': float('nan')}, {'start': '2026-10-11', 'end': '2026-10-01'}):
            with self.assertRaises(ValueError):
                service.search_imagery('-77.1,-12.1,-77,-12', **args)

    def test_bad_polygon_and_crop_size(self):
        for geometry in ({'type': 'Point'}, {'type': 'Polygon', 'coordinates': [[[0, 0]]]}):
            with self.assertRaises(ValueError):
                service.validate_aoi(None, geometry)
        with self.assertRaises(ValueError):
            service.crop_geotiff('bad', '-77.5,-12.5,-77,-12')

    def test_resolve_rejects_ids_and_caches(self):
        service.resolve_item.cache_clear()
        with self.assertRaises(ValueError):
            service.resolve_item('../secret')
        item = {'assets': {'visual': {'href': 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/a.tif'}}}
        with patch.object(service, '_json', return_value=item) as fetch:
            self.assertEqual(service.resolve_item('S2B_18LTM_20261006_0_L2A'), item)
            service.resolve_item('S2B_18LTM_20261006_0_L2A')
            self.assertEqual(fetch.call_count, 1)
        service.resolve_item.cache_clear()

    def test_missing_date_and_bad_asset_not_exposed(self):
        data = {'features': [{'properties': {}}, {'properties': {'datetime': '2026-10-01'}, 'assets': {}}]}
        with patch.object(service, '_json', return_value=data):
            self.assertEqual(service.search_imagery('-77.1,-12.1,-77,-12')['items'], [])

    def test_local_raster_polygon_crop_and_png(self):
        try:
            import rasterio
            import numpy as np
        except ImportError:
            self.skipTest('rasterio optional')
        from rasterio.io import MemoryFile
        from rasterio.transform import from_bounds
        from peru_intel import config
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'fixture.tif'
            with rasterio.open(path, 'w', driver='GTiff', width=100, height=100, count=3, dtype='uint8',
                               crs='EPSG:4326', transform=from_bounds(-77.1,-12.1,-77,-12,100,100)) as target:
                target.write(np.full((3,100,100), 80, dtype='uint8'))
            item = {'properties': {'datetime': '2026-10-06T15:26:35Z'}}
            polygon = {'type':'Polygon','coordinates':[[[-77.09,-12.09],[-77.01,-12.09],[-77.09,-12.01],[-77.09,-12.09]]]}
            with patch.object(service, 'resolve_item', return_value=item), patch.object(service, 'visual_asset', return_value=str(path)), patch.object(config, 'DATA', Path(folder)):
                content = service.crop_geotiff('fixture', geometry=polygon)
                with MemoryFile(content) as file:
                    with file.open() as result:
                        self.assertEqual(result.crs.to_epsg(), 4326)
                        self.assertEqual(result.tags()['acquisition_datetime'], item['properties']['datetime'])
                        self.assertIn(0, np.unique(result.read()))
                png = service.render_tile('fixture', 0, 0, 0)
                self.assertTrue(png.startswith(b'\x89PNG'))
                self.assertEqual(service.render_tile('fixture', 0, 0, 0), png)
        with self.assertRaises(ValueError):
            service.render_tile('bad', 0, 1, 0)
