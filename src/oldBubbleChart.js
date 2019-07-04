// x: HDI
    // y: GPI
    // radius: num refugees by country
    // color: single/family ratio
    // TODO - GPI is broken, changing family status filter changes this value, but in an inconsistent way
    var countryBubbleGroup = countryDimension.group().reduce(
      function(p, d) {
        var count = parseInt(d.count)
        p.count += count;
        if (d.familyStatus == "S") {
          p.single += count;
        } else {
          p.family += count;
        }
        p.hdi += parseFloat(d.hdi) * count;
        p.gpi += parseFloat(d.gpi) * count;
        return p
      },
      function(p, d) {
        var count = parseInt(d.count)
        p.count -= count;
        if (d.familyStatus == "S") {
          p.single -= count;
        } else {
          p.family -= count;
        }
        p.hdi -= parseFloat(d.hdi) * count;
        p.gpi -= parseFloat(d.gpi) * count;
        return p
      },
      function() {
        return {
          count: 0,
          single: 0,
          family: 0,
          hdi: 0,
          gpi: 0
        }
      }
    );


// a lot of addition/subtraction seems to create a number larger than Number.EPSILON
    // this is MUCH bigger, but still very small relative to actual HDI and GPI values
    var hdiGpiEpsilon = 0.01;
    // *** Bubble Chart ***
    // x: HDI
    // y: GPI
    // radius: num refugees by country
    // color: single/family ratio
    bubbleChart
      .width(500)
      .height(300)
      .transitionDuration(1000)
      .margins({top: 20, right: 0, bottom: 30, left: 40})
      .dimension(countryDimension)
      .group(countryBubbleGroup)
      .colors(d3.interpolateRdYlGn)
      .colorAccessor(function (d) {
        // want the single/family ratio
        // TODO - deal with no families in a better way
        return 1 - d.value.single / d.value.count;
      })
      .keyAccessor(function (p) {
        if (p.value.hdi < hdiGpiEpsilon) {
          return counntryDataDict[getCountryName(p.key)].hdi;
        }
        return p.value.hdi / p.value.count;
      })
      .valueAccessor(function (p) {
        if (p.value.gpi < hdiGpiEpsilon) {
          return counntryDataDict[getCountryName(p.key)].gpi;
        }
        return p.value.gpi / p.value.count;
      })
      .radiusValueAccessor(function (p) {
        return p.value.count;
      })
      .maxBubbleRelativeSize(0.3) // don't really know what this does...
      .x(d3.scaleLinear().domain([0, 1])) // or what scaling I should use...
      .y(d3.scaleLinear().domain([0, 4]))
      .r(d3.scaleLinear().domain([0, 10000]))
      .elasticY(true)
      .elasticX(true)
      // .yAxisPadding(100)
      // .xAxisPadding(500)
      .renderHorizontalGridLines(true)
      .xAxisLabel('Human Development Index')
      .yAxisLabel('Global Peace Index')
      .renderLabel(false)
      .label(function(p) {
        return getCountryName(p.key);
      })
      .renderTitle(true)
      .title(function (p) {
        return [
          getCountryName(p.key),
          'Number of refugees: ' + (p.value.count == undefined ? "0" : p.value.count),
          'HDI: ' + numberFormat(p.value.hdi / p.value.count),
          'GPI: ' + numberFormat(p.value.gpi / p.value.count),
          '% of singles: ' + numberFormat(p.value.single / p.value.count)
        ].join('\n')
      })
      .on('renderlet', function(chart, filter){
        chart.svg().select(".chart-body").attr("clip-path",null);
      })
      .on('filtered', function(e, countryTag) {
        // highlight map, need to find layer
        geoJsonLayerGroup.eachLayer(function (layer) {
          if (countryTag == null) {
            // this is a clear
            resetHighlight({target: layer.getLayers()[0]});
          } else if (layer.id == getCountryCode(countryTag)) {
            var eSpoof = {target: layer.getLayers()[0]}; // layers are weird...
            if (bubbleChart.filters().indexOf(countryTag) < 0) {
              resetHighlight(eSpoof);
            } else {
              highlightFeature(eSpoof);
            }
          }
        });
      })
      .xAxisPadding(0.1) // has to be done manually...
      .yAxisPadding(0.4);
    document.getElementById("bubble-chart-reset").addEventListener("click", function() {
      bubbleChart.filterAll();
      dc.redrawAll();
    });