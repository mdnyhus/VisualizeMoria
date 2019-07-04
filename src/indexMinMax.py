startYear = 2015

def getMinMax(fileName):
  indexDict = dict()
  data = [x[:-1].split(',') for x in open(fileName, 'r').readlines()]
  max = None
  min = None
  # skip header line
  for row in data[1:]:
    country = row[0]
    year = int(row[1])
    value = float(row[2])
    if year >= startYear:
      if max == None or value > max:
        max = value
      if min == None or value < min:
        min = value
  return (max, min)

(hdiMax, hdiMin) = getMinMax("hdi.csv")
print("hdiMax: " + str(hdiMax))
print("hdiMin: " + str(hdiMin))

(gpiMax, gpiMin) = getMinMax("gpi.csv")
print("gpiMax: " + str(gpiMax))
print("gpiMin: " + str(gpiMin))
