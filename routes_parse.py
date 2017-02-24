import json as JSON

with open("map_files/shapes_out.json", "w") as json_out:
    with open("map_files/shapes.json", "r") as json_in:
        json_in = JSON.load(json_in)
        json_new = {}
        for line in json_in:
            data = json_in[line]
            ref = line[:line.find('.')]
            direc = line[line.rfind('.') + 1]
            seq_in = int(data["sequence"])
            if direc == 'N' and (ref not in json_new or
               seq_in > json_new[ref]["seq_out"]):
                json_new[ref] = {}
                json_new[ref]["color"] = data["color"]
                json_new[ref]["points"] = data["points"]
                json_new[ref]["seq_out"] = seq_in
                # for pt in data["points"]:
                #     if pt not in json_new[ref]["points"]:
                #         json_new[ref]["points"].append(pt)
        geojson_new = {"type": "FeatureCollection", "features": []}
        for ref in json_new:
            geojson_ins = {
                "type": "Feature",
                "properties": {
                    "color": json_new[ref]["color"],
                    "sequenceCount": json_new[ref]["seq_out"],
                    "route_id": ref
                },
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [json_new[ref]["points"]]
                }}
            geojson_new["features"].append(geojson_ins)

        JSON.dump(geojson_new, json_out)
