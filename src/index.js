import * as d3 from 'd3'
import crossfilter from 'crossfilter'
import * as dc from 'dc'


import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import 'dc/style/dc.scss'

/* This code is needed to properly load the images in the Leaflet CSS */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const map = L.map('map');
// const defaultCenter = [39.1345794,26.5035643];
const defaultCenter = [10.108966,40.5155237];
const defaultZoom = 2;
const basemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
});

map.setView(defaultCenter, defaultZoom);

basemap.addTo(map);

var countrySpoofChart = dc.barChart('#country-spoof-chart');

var compositeChart = dc.compositeChart('#composite-chart');
var regionBubbleChart = dc.bubbleChart('#region-bubble-chart');

var hdiChart = dc.barChart('#hdi-chart');
var gpiChart = dc.barChart('#gpi-chart');
var arrivalChart = dc.barChart('#arrival-chart');

var genderPieChart = dc.pieChart('#gender-pie-chart');
var familyStatusPieChart = dc.pieChart('#family-status-pie-chart');
var ageChart = dc.rowChart('#age-chart');
// var regionChart = dc.rowChart('#region-chart');

// todo - fix folder structure
d3.csv('../src/fakeDataBucketed.csv').then(function (data) {
  d3.csv('../src/countryData.csv').then(function (countryData) {
    function normaliseIndex(value, min, max) {
      // from https://www.globalslaveryindex.org/2018/methodology/vulnerability/
      // linear scale to 1-100
      return 1 + (value - min) * (100 - 1) / (max - min);
    }
    
    // from python analysis, on scale >= 2015
    var gpiMax = 3.814;
    var gpiMin = 1.096;
    var hdiMax = 0.953;
    var hdiMin = 0.339;
    
    function normaliseGpi(value) {
      return normaliseIndex(value, gpiMin, gpiMax);
    }
    
    function normaliseHdi(value) {
      return normaliseIndex(value, hdiMin, hdiMax);
    }
    
    // ******** Country Meta Data ***********
    var counntryDataDict = {};
    var regionDataDict = {};
    countryData.forEach(function(obj) {
      var lat = obj["lat"];
      lat = (lat.substring(lat.length - 1) == "S" ? -1 : 1) * parseFloat(lat.substring(0, lat.length - 1));
      var lon = obj["lon"];
      lon = (lon.substring(lon.length - 1) == "W" ? -1 : 1) * parseFloat(lon.substring(0, lon.length - 1));
      var region = obj["continent"];
      if (obj["region"] != "") {
        region = obj["region"];
      }
      if (obj["subregion"] != "") {
        region = obj["subregion"];
      }
      if (!regionDataDict.hasOwnProperty(region)) {
        regionDataDict[region] = {"lat": 0, "lon": 0, "countries": []}
      }
      regionDataDict[region].lat += lat
      regionDataDict[region].lon += lon
      regionDataDict[region].countries.push(obj["country"])
      
      // ignore 2014 data
      // mean is 2015-2018
      var gpis = [normaliseGpi(obj["gpi2015"]), normaliseGpi(obj["gpi2016"]), normaliseGpi(obj["gpi2017"]), normaliseGpi(obj["gpi2018"])]
      var gpiMean = gpis.reduce((a,b) => a + b, 0) / gpis.length;
      var hdis = [normaliseHdi(obj["hdi2015"]), normaliseHdi(obj["hdi2016"]), normaliseHdi(obj["hdi2017"]), normaliseHdi(obj["hdi2018"])]
      var hdiMean = hdis.reduce((a,b) => a + b, 0) / hdis.length;
      counntryDataDict[obj["country"]] = {"lat": lat, "lon": lon, "region": region, "code": obj["code"], "gpi": normaliseGpi(parseFloat(obj["gpi"])), "hdi": normaliseHdi(parseFloat(obj["hdi"]))};
    });
    
    
    var numberFormat = d3.format('.2f');
    var dateFormatSpecifier = '%d-%m-%Y';
    var dateFormat = d3.timeFormat(dateFormatSpecifier);
    var dateFormatParser = d3.timeParse(dateFormatSpecifier);
    
    var binWidth = 2.5;
    var indexStart = 0; // looks nicer
    var indexEnd = 100 + binWidth; // todo - don't know how to fix this...
    data.forEach(function (d) {
        // d.dd = dateFormatParser(d.date);
        // d.month = d3.timeMonth(d.dd); // pre-calculate month for better performance
        // d.close = +d.close; // coerce to number
        // d.open = +d.open;
        // d.yearArrival = new Date(d.arrival.split("-")[1], 0, 1);
        d.yearArrival = parseInt(d.arrival.split("-")[1]);
        d.arrival = d3.timeMonth(dateFormatParser("01-" + d.arrival));
        d.gpiOG = d.gpi;
        d.hdiOG = d.hdi;
        d.hdi = normaliseHdi(parseFloat(d.hdi));
        d.gpi = normaliseGpi(parseFloat(d.gpi));
        d.gpiBin = parseFloat(numberFormat(binWidth * Math.floor((d.gpi + binWidth / 2) / binWidth)));
        d.hdiBin = parseFloat(numberFormat(binWidth * Math.floor((d.hdi + binWidth / 2) / binWidth)));
    });
    
    
    function genderKeyToTitle(key) {
      if (key == "F") {
        return "Female";
      }
      return "Male"
    }
    
    function familyStatusKeyToTitle(key) {
      if (key == "S") {
        return "Single";
      }
      return "Family"
    }    
    
    // ********** Dimenstions and Groups *********
    function reduceAdd(p, d) {
      return p + parseInt(d.count);
    }
    function reduceRemove(p, d) {
      return p - parseInt(d.count);
    }
    function reduceInitial() {
      return 0;
    }
    
    var cData = crossfilter(data);
    var all = cData.groupAll().reduce(reduceAdd, reduceRemove, reduceInitial);
    // kind of hacky...
    var countryDimension = cData.dimension(function (d) {
      return d.ccode + d.country;
    });
    function getCountryName(countryCodeKey) {
      return countryCodeKey.substring(3);
    }
    function getCountryCode(countryCodeKey) {
      return countryCodeKey.substring(0,3);
    }
    var countryGroup = countryDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
    var countryMapGroup = countryDimension.group().reduce(
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
    
      
    var countryCodeDimension = cData.dimension(function (d) {
      return d.ccode + d.country;
    });
    var countryCodeGroup = countryCodeDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
    
    var regionDimension = cData.dimension(function (d) {
      return d.region;
    });
    var regionGroup = regionDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
    
    var ageDimension = cData.dimension(function (d) {
      return d.ageBucket;
    });
    var ageGroup = ageDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
    function getNumYears(ageBucket) {
      var startAge = 0;
      var endAge = 0;
      if (ageBucket.includes("+")) {
        startAge = parseInt(ageBucket.substring(0, ageBucket.length - 1));
        endAge = 90; // hardcoded
      } else {
        var ages = ageBucket.split("-")
        startAge = parseInt(ages[0])
        endAge = parseInt(ages[1])
      }
      return endAge - startAge + 1;    
    }
    var ageGroupCountPerYear = ageDimension.group().reduce(
      function(p, d) {
        return p + parseInt(d.count) / getNumYears(d.ageBucket);
      },
      function(p, d) {
        return p - parseInt(d.count) / getNumYears(d.ageBucket);
      },
      function() {
        return 0;
      });
    
    var arrivalDimension = cData.dimension(function (d) {
      return d.arrival;
    });
    var arrivalGroup = arrivalDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
      
    var arrivalYearDimension = cData.dimension(function (d) {
      return d.yearArrival;
    });
    var arrivalYearGroup = arrivalYearDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
    // x: GPI
    // y: HDI
    // radius: num refugees by country
    // color: single/family ratio
    // TODO - GPI is broken, changing family status filter changes this value, but in an inconsistent way
    var arrivalYearCompositeGroup = arrivalYearDimension.group().reduce(
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
    
    var familyStatusDimension = cData.dimension(function (d) {
      return d.familyStatus;
    });  
    var familyStatusGroup = familyStatusDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
    
    var genderDimension = cData.dimension(function (d) {
      return d.gender;
    });
    var genderGroup = genderDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
      
    var gpiDimension = cData.dimension(function (d) {
      return d.gpi;
    });
    var gpiGroup = gpiDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
     
    // var hdiStart = 0.32; // from data
    // var hdiEnd = 0.87;
    // var hdiBinWidth = 0.01; // 44 steps
    var hdiHistogramDimension = cData.dimension(function (d) {
      // return numberFormat(binWidth * Math.floor((d.hdi + binWidth / 2) / binWidth));
      return d.hdiBin;
    });
    var hdiHistogramGroup = hdiHistogramDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);
      
    // var gpiStart = 1.7; // from data
    // var gpiEnd = 3.9;
    // var gpiBinWidth = 0.04; // 55 steps
    var gpiHistogramDimension = cData.dimension(function (d) {
      // return numberFormat(binWidth * Math.floor((d.gpi + binWidth / 2) / binWidth));
      return d.gpiBin;
    });
    var gpiHistogramGroup = gpiHistogramDimension.group()
      .reduce(reduceAdd, reduceRemove, reduceInitial);

    function colorWithGrey(a) {
      if (a == 0) {
        return "rgb(229,229,229)";
      }
      // - some color gradient? don't know what this is...
      return d3.interpolateRdYlGn(a); 
    }
    
    countrySpoofChart
      .width(100)
      .height(100)
      // .margins({top: 0, right: 10, bottom: 20, left: 10}) // TODO - customize
      .dimension(countryDimension)
      .group(countryGroup)
      .x(d3.scaleBand())
      .xUnits(dc.units.ordinal)
      .on('filtered', function(d) {
        if (countrySpoofChart.filters().length > 0) {
          document.getElementById("map-reset-container").style = "";
        } else {
          document.getElementById("map-reset-container").style = "display: none;";
        }
      });
      // .centerBar(true)
      // .x(d3.scaleLinear().domain([gpiStart, gpiEnd]))
      // .alwaysUseRounding(true)
      // .xUnits(dc.units.fp.precision(gpiBinWidth))
      
    
    // a lot of addition/subtraction seems to create a number larger than Number.EPSILON
    // this is MUCH bigger, but still very small relative to actual HDI and GPI values
    var hdiGpiEpsilon = 0.01;
    // *** Bubble Chart ***
    // x: HDI
    // y: GPI
    // radius: num refugees by country
    // color: single/family ratio
    function getHdiValueCompositeChart(p) {
      if (p.value.count == 0) {
        // todo - fix
        return 0;
      }
      return p.value.hdi / p.value.count;
    }
    function getGpiValueCompositeChart(p) {
      if (p.value.count == 0) {
        // todo - fix
        return 0;
      }
      return p.value.gpi / p.value.count;
    }
    compositeChart
      .width(500)
      .height(300)
      .transitionDuration(1000)
      .margins({top: 10, right: 40, bottom: 30, left: 40})
      .dimension(arrivalYearDimension)
      .group(arrivalYearCompositeGroup)
      .x(d3.scaleOrdinal().domain(d3.range(2015,2019)))
      .xUnits(dc.units.ordinal)
      ._rangeBandPadding(1) // hack for old issue, see https://github.com/dc-js/dc.js/issues/662
      .elasticY(true)
      .renderHorizontalGridLines(false)
      .legend(dc.legend().x(57).y(10).itemHeight(13).gap(5))
      .brushOn(false)
      .title(function(p) {
        return [
          'Number of refugees: ' + (p.value.count == undefined ? "0" : p.value.count),
          'GPI: ' + numberFormat(getGpiValueCompositeChart(p)),
          'HDI: ' + numberFormat(getHdiValueCompositeChart(p))
        ].join("\n");
      })
      .compose([
        dc.barChart(compositeChart)
          .dimension(arrivalYearDimension)
          .group(arrivalYearCompositeGroup, "Refugees")
          .valueAccessor(function (p) {
            return p.value.count;
          })
          .centerBar(true)
          .gap(5) // required for ._rangeBandPadding(1)
          .on('filtered', function(e, countryTag) {
            initializeMapLayers();
          }),
        dc.lineChart(compositeChart)
          .dimension(arrivalYearDimension)
          .group(arrivalYearCompositeGroup, "GPI")
          .valueAccessor(getGpiValueCompositeChart)
          .ordinalColors(["orange"])
          .useRightYAxis(true)
          .renderDataPoints(true)
          .defined(function(d) {
            return getGpiValueCompositeChart(d.data) != 0;
          }),
        dc.lineChart(compositeChart)
          .dimension(arrivalYearDimension)
          .group(arrivalYearCompositeGroup, "HDI")
          .valueAccessor(getHdiValueCompositeChart)
          .ordinalColors(["pink"])
          .useRightYAxis(true)
          .renderDataPoints(true)
          .defined(function(d) {
            return getHdiValueCompositeChart(d.data) != 0;
          })
      ])
      .yAxisLabel("Number of refugees")
      .yAxisPadding(5)
      .xAxisPadding(-100)
      .rightYAxisLabel("GPI/HDI")
      .on('renderlet', function(chart, filter){
        chart.svg().select(".chart-body").attr("clip-path",null);
      })
      .on('filtered', function(e, countryTag) {
        initializeMapLayers();
      })
      .xAxis().ticks(4);
    compositeChart.xAxis().tickFormat(d3.format("d"));
    document.getElementById("composite-chart-reset").addEventListener("click", function() {
      compositeChart.filterAll();
      dc.redrawAll();
    });
    
    
    // *** HDI chart ***
    hdiChart.width(250)
      .height(50)
      .margins({top: 0, right: 10, bottom: 20, left: 10}) // TODO - customize
      .dimension(hdiHistogramDimension)
      .group(hdiHistogramGroup)
      // .centerBar(true)
      .x(d3.scaleLinear().domain([indexStart, indexEnd]))
      // .alwaysUseRounding(true)
      .xUnits(dc.units.fp.precision(binWidth))
      .valueAccessor(function (p) {
        if (p.value < 1) {
          return 0;
        }
        return Math.log(p.value) + 1;
      })
      .on('filtered', function() {
        initializeMapLayers();
      })
      .xAxis().ticks(5);
    document.getElementById("hdi-chart-reset").addEventListener("click", function() {
      hdiChart.filterAll();
      dc.redrawAll();
    });
      
    // *** GPI chart ***
    gpiChart.width(250)
      .height(50)
      .margins({top: 0, right: 10, bottom: 20, left: 10}) // TODO - customize
      .dimension(gpiHistogramDimension)
      .group(gpiHistogramGroup)
      // .centerBar(true)
      .x(d3.scaleLinear().domain([indexStart, indexEnd]))
      // .alwaysUseRounding(true)
      .xUnits(dc.units.fp.precision(binWidth))
      .valueAccessor(function (p) {
        if (p.value < 1) {
          return 0;
        }
        return Math.log(p.value) + 1;
      })
      .on('filtered', function() {
        initializeMapLayers();
      })
      .xAxis().ticks(5);
    document.getElementById("gpi-chart-reset").addEventListener("click", function() {
      gpiChart.filterAll();
      dc.redrawAll();
    });
    
    // *** Arrival chart ***
    arrivalChart.width(1000)
      .height(100)
      .margins({top: 0, right: 20, bottom: 20, left: 20}) // TODO - customize
      .dimension(arrivalDimension)
      .group(arrivalGroup)
      .x(d3.scaleTime().domain([new Date(2015, 0, 1), new Date(2018, 11, 31)]))
      .xUnits(d3.timeMonths)
      .elasticY(true)
      .on('filtered', function() {
        initializeMapLayers();
      });
    document.getElementById("arrival-chart-reset").addEventListener("click", function() {
      arrivalChart.filterAll();
      dc.redrawAll();
    });
      
    // *** Region Bubble Chart ***
    // x: Lon
    // y: Lat
    // radius: constant (too annoying otherwise)
    // color: num refugees by country
    regionBubbleChart
      .width(300)
      .height(300)
      .transitionDuration(1000)
      .margins({top: 65, right: 60, bottom: 50, left: 50})
      .dimension(regionDimension) // not sure if right dimension...
      .group(regionGroup)
      .colors(colorWithGrey)
      .colorAccessor(function (p) {
        var values = regionGroup.all().map(function(countryVal) {return countryVal.value;})
        var minCountByRegion = 0;//Math.min(...values);
        var maxCountByRegion = Math.max(...values);
    
        return normalizeColour(p.value, minCountByRegion, maxCountByRegion);
      })
      .keyAccessor(function (p) {
        return regionDataDict[p.key].lon / regionDataDict[p.key].countries.length;
      })
      .valueAccessor(function (p) {
        return regionDataDict[p.key].lat / regionDataDict[p.key].countries.length;
      })
      .radiusValueAccessor(function (p) {
        return 100;
      })
      .maxBubbleRelativeSize(8)
      .x(d3.scaleLinear().domain([-180, 180])) // or what scaling I should use...
      .y(d3.scaleLinear().domain([-180, 180]))
      .r(d3.scaleLinear().domain([0, 10000]))
      .elasticY(true)
      .elasticX(true)
      .renderLabel(false)
      .label(function(p) {
        return p.key;
      })
      .renderTitle(true)
      .title(function (p) {
        return [
          p.key,
          'Number of refugees: ' + (p.value == undefined ? "0" : p.value)
        ].join('\n')
      })
      .on('renderlet', function(chart, filter){
        chart.svg().select(".chart-body").attr("clip-path",null);
      })
      .on('filtered', function(e, regionTag) {
        if (regionTag == null) {
          // clear all
          countrySpoofChart.filterAll();
        } else {
          var isRegionSelect = regionBubbleChart.filters().indexOf(regionTag) >= 0;
          regionDataDict[regionTag].countries.forEach(function(country) {
            var bubbleChartLabel = counntryDataDict[country].code.toLowerCase() + country;
            var isCountrySelected = countrySpoofChart.filters().indexOf(bubbleChartLabel) >= 0;
            if (isRegionSelect != isCountrySelected) {
              countrySpoofChart.filter(bubbleChartLabel);
            }
          });
        }
        initializeMapLayers();
      })
      .xAxisPadding(0.1) // has to be done manually...
      .yAxisPadding(0.4);
    document.getElementById("region-bubble-chart-reset").addEventListener("click", function() {
      regionBubbleChart.filterAll();
      dc.redrawAll();
    });
    
    // *** Gender Pie Chart ***
    genderPieChart
      .width(200)
      .height(160)
      .radius(75)
      .dimension(genderDimension)
      .group(genderGroup)
      .label(function (d) {
        if (genderPieChart.hasFilter() && !genderPieChart.hasFilter(d.key)) {
          return genderKeyToTitle(d.key) + ' (0%)';
        }
        var label = genderKeyToTitle(d.key);
        if (all.value()) {
          label += ' (' + Math.round(d.value / all.value() * 100) + '%)';
        }
        return label;
      })
      .renderLabel(true)
      .on('filtered', function() {
        initializeMapLayers();
      });
    document.getElementById("gender-pie-chart-reset").addEventListener("click", function() {
      genderPieChart.filterAll();
      dc.redrawAll();
    });
    
    // *** Family Status Pie Chart ****
    familyStatusPieChart
      .width(200)
      .height(160)
      .radius(75)
      .dimension(familyStatusDimension)
      .group(familyStatusGroup)
      .label(function (d) {
        if (familyStatusPieChart.hasFilter() && !familyStatusPieChart.hasFilter(d.key)) {
          return familyStatusKeyToTitle(d.key) + '(0%)';
        }
        var label = familyStatusKeyToTitle(d.key);
        if (all.value()) {
          label += '(' + Math.round(d.value / all.value() * 100) + '%)';
        }
        return label;
      })
      .renderLabel(true)
      .on('filtered', function() {
        initializeMapLayers();
      });
    document.getElementById("family-status-pie-chart-reset").addEventListener("click", function() {
      familyStatusPieChart.filterAll();
      dc.redrawAll();
    });
    
    // *** Age Bar Chart ***
    ageChart
      .width(300)
      .height(385)
      .margins({top: 20, left: 40, right: 10, bottom: 20})
      .labelOffsetX(-5)
      // .title(function (p) {
        // return p.key + ": " + p.value.count;
      // })
      .dimension(ageDimension)
      // .group(ageGroupCountPerYear)
      .group(ageGroup)
      .ordering(function(d) {
        return parseInt(d.key.split("-")[0]);
      })
      .on('filtered', function() {
        initializeMapLayers();
      })
      .elasticX(true)
      .xAxis().ticks(4);
    document.getElementById("age-chart-reset").addEventListener("click", function() {
      ageChart.filterAll();
      dc.redrawAll();
    });
    
    var colourLogCutoff = 1
    // *** Map ***
    map.invalidateSize();
    function normalizeColour(value, valueMin, valueMax) {
      if (value == 0) {
        return 0;
      }
      if ((valueMax - valueMin) > colourLogCutoff) {
        // a "normal" noramlize doesn't work, try a logarithmic normalization
        return Math.log(value - valueMin) / Math.log(valueMax - valueMin);      
      } else {
        return (value - valueMin) / (valueMax - valueMin);      
      }
    }
    
    // TODO - surely this shouldn't be here??
    var info = L.control();
    info.onAdd = function(map) {
      this._div = L.DomUtil.create('div', 'info');
      this.update();
      return this._div;
    };

    info.update = function (props) {
      this._div.style = props ? '' : 'display: none;';
      this._div.innerHTML = props 
        ? '<h4>' + props.country + '</h4>' +
          'Number of refugees: ' + (props.value == undefined ? "0" : props.value) +
          '<br>GPI: ' + numberFormat(props.gpi < indexStart || props.gpi > indexEnd ? counntryDataDict[props.country].gpiMean : props.gpi) +
          '<br>HDI: ' + numberFormat(props.hdi < indexStart || props.hdi > indexEnd ? counntryDataDict[props.country].hdiMean : props.hdi)
        : '';
    }
    info.addTo(map)

    function styleCountry(feature) {
      return {
        fillColor: colorWithGrey(normalizeColour(feature.properties.value, 0, feature.properties.valueMax)),
        // fillColor: colorWithGrey(normalizeColour(feature.properties.value, feature.properties.valueMin, feature.properties.valueMax)),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
      };
    }
    function highlightFeature(e) {
      var layer = e.target;
      layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
      });
      
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
      }
      
      info.update(layer.feature.properties);
    }

    function getBubbleChartLabel(properties) {
      return properties.code + properties.country;
    }
    
    // TODO - white dashed lines are overtop of grey outlines for selected countries
    function resetHighlight(e) {
      // if (bubbleChart.filters().indexOf(getBubbleChartLabel(e.target.feature.properties)) < 0) {
      if (countrySpoofChart.filters().indexOf(getBubbleChartLabel(e.target.feature.properties)) < 0) {
        // var layer = e.target;
        // TODO - duplicated code
        e.target.setStyle({
          weight: 2,
          color: 'white',
          dashArray: '3',
          fillOpacity: 0.7
        });
      }
      info.update();
    }

    function filterCountry(e) {
      // bubbleChart.filter(getBubbleChartLabel(e.target.feature.properties));
      countrySpoofChart.filter(getBubbleChartLabel(e.target.feature.properties));
      dc.redrawAll();
    }

    function onEachFeature(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: filterCountry
      });
    }
    function loadGeoJson(countryCode, country, value, valueMin, valueMax, hdi, gpi, layerGroup) {
      import('../src/countryGeoJson/' + countryCode + '.geo.json')
        .then(geoJson => {
          geoJson.default.features[0].properties.value = value;
          geoJson.default.features[0].properties.valueMin = valueMin;
          geoJson.default.features[0].properties.valueMax = valueMax;
          geoJson.default.features[0].properties.country = country;
          geoJson.default.features[0].properties.code = countryCode;
          geoJson.default.features[0].properties.hdi = hdi;
          geoJson.default.features[0].properties.gpi = gpi;
          var geoJsonLayer = L.geoJSON(geoJson.default.features, {style: styleCountry, onEachFeature: onEachFeature}).addTo(map);
          geoJsonLayer.id = countryCode;
          layerGroup.addLayer(geoJsonLayer);
          // if (bubbleChart.filters().indexOf(countryCode + country) >= 0) {
          if (countrySpoofChart.filters().indexOf(countryCode + country) >= 0) {
            highlightFeature({target: geoJsonLayer.getLayers()[0]}); // layers are weird...
          }
        });
    }
    
    var geoJsonLayerGroup = L.layerGroup().addTo(map);
    var mapLegend;
    function initializeMapLayers() {
      geoJsonLayerGroup.clearLayers();
      if (mapLegend !== undefined) {
        map.removeControl(mapLegend);
      }
      var values = countryGroup.all().map(function(countryVal) {return countryVal.value;})
      var minCountByCountry = 0;//Math.min(...values);
      var maxCountByCountry = Math.max(...values);
      countryMapGroup.all().forEach(function (data) {
        var code = data.key.substring(0,3);
        var country = data.key.substring(3);
        loadGeoJson(code, country, data.value.count, minCountByCountry, maxCountByCountry, data.value.hdi / data.value.count, data.value.gpi / data.value.count,geoJsonLayerGroup);
      });
      
      if (maxCountByCountry > 0) {
        mapLegend = L.control({position: 'bottomright'})
        mapLegend.onAdd = function (map) {
          var div = L.DomUtil.create('div', 'info legend');
          // duplicate code...
          if (maxCountByCountry - minCountByCountry > colourLogCutoff) {
            var numColors = Math.ceil(Math.log10(maxCountByCountry));
            for (var i = 0; i < numColors; i++) {
              var curVal = Math.pow(10, i);
              var nextVal = Math.pow(10, i + 1);;
              if (curVal == 1) {
                curVal = 0;
              }
              div.innerHTML +=
                '<i style="background:' + d3.interpolateRdYlGn(normalizeColour((nextVal + curVal)/2, minCountByCountry, maxCountByCountry)) + '"></i> ' +
                curVal + (i + 1 == numColors ? '+' : '&ndash;' + (nextVal - 1) + '<br>');
            }
          } else {
            var numColors = 6;
            var roughStep = maxCountByCountry / numColors;
            var numZerosMax = Math.floor(Math.log10(roughStep));
            var step = Math.round(roughStep / Math.pow(10, numZerosMax)) * Math.pow(10, numZerosMax);
            var start = 0;
            for (var i = 0; i < numColors; i++) {
              div.innerHTML +=
                '<i style="background:' + d3.interpolateRdYlGn(normalizeColour(start + step/2, minCountByCountry, maxCountByCountry)) + '"></i> ' +
                start + (i + 1 == numColors ? '+' : '&ndash;' + (start + step) + '<br>');
              start += step;
            }
          }
          return div;
        };
        mapLegend.addTo(map);
      }
    }
    
    initializeMapLayers();
    document.getElementById("map-reset").addEventListener("click", function() {
      countrySpoofChart.filterAll();
      dc.redrawAll();
      initializeMapLayers();
    });
    
    dc.renderAll();  
    
    // hacky I know...
    var prContainer = document.createElement("div")
    var pDiv = document.createElement("div")
    pDiv.className = "chart-label";
    pDiv.style = "float: left;";
    pDiv.innerHTML = "Poor";
    prContainer.appendChild(pDiv)
    var rDiv = document.createElement("div")
    rDiv.className = "chart-label";
    rDiv.style = "float: right;";
    rDiv.innerHTML = "Rich";
    prContainer.appendChild(rDiv)
    document.getElementById('hdi-chart').appendChild(prContainer)
    
    var sdContainer = document.createElement("div")
    var dDiv = document.createElement("div")
    dDiv.className = "chart-label";
    dDiv.style = "float: right;";
    dDiv.innerHTML = "Dangerous";
    sdContainer.appendChild(dDiv)
    var sDiv = document.createElement("div")
    sDiv.className = "chart-label";
    sDiv.style = "float: left;";
    sDiv.innerHTML = "Safe";
    sdContainer.appendChild(sDiv)
    document.getElementById('gpi-chart').appendChild(sdContainer)
    
  });
})