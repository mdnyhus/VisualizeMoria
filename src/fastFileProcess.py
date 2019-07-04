regionsFileName = "../../data/regions.csv"
regionsRaw = [x[:-1].split(',') for x in open(regionsFileName, 'r').readlines()]
countryRowDict = dict()
# format: country, code, continent, region, sub-region, economic state
for row in regionsRaw:
  countryRowDict[row[0]] = row
  
capitalLatLonFN = "capitalLatLon.csv"
capitalLatLons = [x[:-1].split(',') for x in open(capitalLatLonFN, 'r').readlines()]

hdiFileName = "hdi.csv"
hdi = dict()
hdiData = [x[:-1].split(',') for x in open(hdiFileName, 'r').readlines()]
# skip header line
for hdiRow in hdiData[1:]:
  country = hdiRow[0]
  if country not in hdi:
    hdi[country] = []
  hdi[country].append(float(hdiRow[2]))
  if int(hdiRow[1]) == 2017:
    # hdi2018 = hdi2017 until new data is released
    hdi[country].append(float(hdiRow[2]))
# for country in hdi:
  # hdi[country] = sum(hdi[country]) / len(hdi[country])
  
gpiFileName = "gpi.csv"
gpi = dict()
gpiData = [x[:-1].split(',') for x in open(gpiFileName, 'r').readlines()]
# skip header line
for gpiRow in gpiData[1:]:
  country = gpiRow[0]
  if country not in gpi:
    gpi[country] = []
  gpi[country].append(float(gpiRow[2]))
# for country in gpi:
  # gpi[country] = sum(gpi[country]) / len(gpi[country])
  
def roundTo4Decimals(floatVal):
  return str(round(floatVal, 4))
  
with open("countryData.csv", 'w+') as out:
  # gpi/hdi years are hardcoded :(
  out.write("country,code,continent,region,subregion,economicState,lat,lon,gpi2014,gpi2015,gpi2016,gpi2017,gpi2018,hdi2014,hdi2015,hdi2016,hdi2017,hdi2018\n")
  for row in capitalLatLons[1:]:
    if row[0] in countryRowDict and row[0] in hdi and row[0] in gpi:
      out.write(",".join(countryRowDict[row[0]]) + "," + row[1] + "," + row[2] + "," + ",".join([str(x) for x in gpi[row[0]]]) + "," + ",".join([str(x) for x in hdi[row[0]]]) + "\n")