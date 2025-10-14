################################################################################
## import_data.R
## import data from EUROSTAT and other sources. Merge into one data.frame
################################################################################
setwd("~/Dropbox/Masterarbeit/")

year <- 2020 # ifelse(is.null(getOption("year")), 2010, getOption("year"))
year0 <- 2008

################################################################################
nuts.pattern <- "^(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|EL|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|UK|GB|)"

################################################################################


################################################################################
## import patent data from REGPAT database
################################################################################
library("DBI")
library("duckdb")
con <- dbConnect(duckdb::duckdb(), dbdir = "regpat.duckdb")

path.to.regpat <- "~/regpat"
inv.path <- file.path(path.to.regpat, "202505_EPO_Inv_reg.txt")
ipc.path <- file.path(path.to.regpat, "202505_EPO_IPC.txt")

sql <- sprintf("
WITH inv AS (
  SELECT
    appln_id,
    reg_code AS geo,
    inv_share * reg_share AS weight
  FROM read_csv('%s', delim='|', header=TRUE, auto_detect=TRUE, sample_size=-1)
  WHERE reg_code IS NOT NULL
),
ipc AS (
  SELECT
    appln_id,
    CAST(prio_year AS INTEGER) AS year
  FROM read_csv('%s', delim='|', header=TRUE, auto_detect=TRUE, sample_size=-1)
  WHERE prio_year IS NOT NULL
)
SELECT
  i.geo,
  p.year,
  SUM(i.weight) AS patents
FROM inv i
JOIN ipc p USING (appln_id)
WHERE p.year BETWEEN 2008 AND 2025
GROUP BY i.geo, p.year
ORDER BY i.geo, p.year;
", inv.path, ipc.path)

patents <- dbGetQuery(con, sql)
saveRDS(patents, "data/patents.rds")
dbDisconnect(con, shutdown = TRUE)

patents$geo <- as.character(patents$geo)
patents$year    <- as.integer(patents$year)
patents$patents <- as.numeric(patents$patents)

pat <- patents[patents$geo %in% nuts::all_nuts_codes$code, ]
pat <- patents[patents$year %in% c(2008, 2020), ]
################################################################################
## check NUTS code version of REGPAT database.
## mainly NUTS 2024 version --> convert all datasets to v 2024 before merge()
## see https://docs.ropensci.org/nuts/ for details
# citation("nuts")
################################################################################
library("remotes")
remotes::install_github("ropensci/nuts")
library("nuts")

uk <- grepl("^UK", pat$geo)
## classify and determine nuts versions
### get most likely NUTS version
library("dplyr")
pat.classify <- nuts_classify(pat, nuts_code = "geo", group_vars = "year")
dominant_versions <- nuts_get_version(pat.classify) |>
  group_by(country) |>
  summarise(best_version = from_version[which.max(overlap_perc)])
summary(as.factor(dominant_versions$best_version))
# 2021 2024
#    1   29
# nuts version 2024 for all but UK --> use 2024 version

## separated UK and non-UK regions
pat.classify.notuk <- nuts_classify(pat[!uk, ], nuts_code = "geo", group_vars = "year")
## convert to 2024 version
pat.converted.notuk <- nuts_convert_version(pat.classify.notuk, to_version = "2021",
  variables = c("patents" = "absolute"), multiple_versions = "most_frequent")

## same for UK regions
pat.classify.uk <- nuts_classify(pat[uk, ], nuts_code = "geo", group_vars = "year")
pat.converted.uk <- nuts_convert_version(pat.classify.uk, to_version = "2021",
  variables = c("patents" = "absolute"), multiple_versions = "most_frequent")
pat.converted.all <- rbind(pat.converted.notuk, pat.converted.uk)
names(pat.converted.all)[grep("code", names(pat.converted.all))] <- "geo"
pat.converted.all <- pat.converted.all[, !grepl("version|country", names(pat.converted.all))]

## classify again just to be able to aggregate patents by nuts level
pat.classify.all <- nuts_classify(pat.converted.all, nuts_code = "geo", group_vars = "year")
pat.nuts2 <- nuts_aggregate(pat.classify.all, to_level = 2,
  variables = c("patents" = "absolute"), multiple_versions = "most_frequent")

pat.nuts2 <- pat.nuts2[, !grepl("country", names(pat.nuts2))]
names(pat.nuts2)[grep("code", names(pat.nuts2))] <- "geo"
################################################################################
## patent growth variable
################################################################################
## aggregate duplicates
pat.agg <- aggregate(patents ~ geo + year, data = pat.nuts2, sum, na.rm = TRUE)
## only keep start year and end year and make it wide
pat.wide <- reshape(pat.agg[pat.agg$year %in% c(year0, 2018:2020), ], idvar = "geo", timevar = "year",
                    direction = "wide")

pat <- pat.wide
year.cols <- grep("^patents\\.", names(pat), value = TRUE)
years <- as.integer(sub("patents\\.", "", year.cols))

first <- min(years)
last  <- max(years)

first.col <- paste0("patents.", first)
last.col  <- paste0("patents.", last)

pat$patentgrowth <- ifelse(
  is.finite(pat[[first.col]]) &
  is.finite(pat[[last.col]]) &
  pat[[first.col]] > 0,
  pat[[last.col]] / pat[[first.col]] - 1,
  NA
)

# pat$patentgrowth <- with(pat,
#   ifelse(is.finite(get(paste0("patents.", first))) &
#     is.finite(get(paste0("patents.", last))) & get(paste0("patents.", first)) > 0,
#     get(paste0("patents.", last)) / get(paste0("patents.", first)), NA)
# )
colnames(pat)[grep("growth", colnames(pat))] <- paste("patentgrowth", first, last, sep = ".")


# *************************************************************************** #
# Dependent variables
# *************************************************************************** #


################################################################################
## EUROSTAT data. needs eurostat package
################################################################################
## download eurostat package from github if needed
library("remotes")
remotes::install_github("ropengov/eurostat")
library("eurostat")

## download population data demo_r_d2jan to create per capita variables
population <- get_eurostat("demo_r_d2jan", time_format = "num",
  filter = list(sinceTimePeriod = 2008, sex = "T", age = "TOTAL"))

## Just to keep memory usage down: first approximation to only keep NUTS2 regions.
## drop superfluous variables.
population <- population[nchar(population$geo) == 4,
  !(colnames(population) %in% c("freq", "unit", "sex", "age"))]
pop <- population[population$geo %in% nuts::all_nuts_codes$code, ]

uk <- grepl("^UK", pop$geo)
## classify and determine nuts versions
### get most likely NUTS version
pop.classify <- nuts_classify(pop, nuts_code = "geo", group_vars = "time")
dominant_versions <- nuts_get_version(pat.classify) |>
  group_by(country) |>
  summarise(best_version = from_version[which.max(overlap_perc)])
summary(as.factor(dominant_versions$best_version))
# 2021 2024
#    1   30
# nuts version 2024 for all but UK --> use 2021 version in attempt to keep UK in resulting dataframe

## separated UK and non-UK regions
pop.classify.notuk <- nuts_classify(pop[!uk, ], nuts_code = "geo", group_vars = "time")
## convert to 2024 version
pop.converted.notuk <- nuts_convert_version(pop.classify.notuk, to_version = "2021",
  variables = c("values" = "absolute"), multiple_versions = "most_frequent")

## same for UK regions
pop.classify.uk <- nuts_classify(pop[uk, ], nuts_code = "geo", group_vars = "time")
pop.converted.uk <- nuts_convert_version(pop.classify.uk, to_version = "2021",
  variables = c("values" = "absolute"), multiple_versions = "most_frequent")
pop.converted.all <- rbind(pop.converted.notuk, pop.converted.uk)
names(pat.converted.all)[grep("code", names(pop.converted.all))] <- "geo"
pop.converted.all <- pop.converted.all[, !grepl("version|country", names(pop.converted.all))]

pop <- pop.converted.all
names(pop)[grep("code", names(pop))] <- "geo"
names(pop)[grep("time", names(pop))] <- "year"

################################################################################
## generate patents per million inhabitants
################################################################################
## make pat "long"
pat.long <- reshape(pat, varying = grep("^patents\\.", names(pat), value = TRUE),
  v.names = "patents", timevar = "year", times = as.integer(gsub("patents\\.",
    "", grep("^patents\\.", names(pat), value = TRUE))), direction = "long")

pat.long <- pat.long[!is.na(pat.long$patents), grepl("geo|year|patent", names(pat.long))]

## merge with population by region "geo" and year "time"
pat.pop <- merge(pat.long, pop,
  by.x = c("geo","year"),
  by.y = c("geo","year"),
  all.x = TRUE)
## only use obs where year 0 = 2008 is available
pat.pop <- pat.pop[pat.pop$year == 2008, ]
names(pat.pop)[names(pat.pop) == "values"] <- "population"
pat.pop$patents.per.million <- with(pat.pop,
  ifelse(is.finite(patents) & is.finite(population) & population > 0,
    patents / (population / 1e6), NA)
  )
## step by step grow data.frame x
x <- pat.pop[, !grepl("version|country", names(pat.pop))]

###########################################################################
## use Gross Expenditure on R&D in Mio Eur PPS, annual data
###########################################################################
rd.expenditure <- get_eurostat("rd_e_gerdreg", time_format = "num", select_time = "A",
  filter = list(unit = "MIO_PPS", sinceTimePeriod = 2008))
rd <- rd.expenditure[nchar(rd.expenditure$geo) == 4 & rd.expenditure$geo %in% nuts::all_nuts_codes$code, ]
rd <- rd[, !grepl("freq|unit", names(rd))]
rd <- rd[rd$time == 2008, ]

# nrow(rd[!is.na(rd$values) & rd$sectperf == "TOTAL", ])
# including rd drops observations from 901 to 186

## again change nuts naming version to 2021
uk <- grepl("^UK", rd$geo)
## classify and determine nuts versions
### get most likely NUTS version
rd.classify <- nuts_classify(rd, nuts_code = "geo", group_vars = c("time", "sectperf"))
dominant_versions <- nuts_get_version(rd.classify) |>
  group_by(country) |>
  summarise(best_version = from_version[which.max(overlap_perc)])
summary(as.factor(dominant_versions$best_version))
# 2006 2016 2021 2024
#    1    1    1   28
# use 2021 version in attempt to keep UK in resulting dataframe
head(dominant_versions)

rd.converted <- nuts_convert_version(rd.classify, to_version = 2021, variables =
    c("values" = "absolute"), multiple_versions = "most_frequent")

parts <- split(rd, rd.classify$data$from_version, drop = TRUE)
conv.list <- lapply(parts, function(x) {
  nuts_convert_version(nuts_classify(x, nuts_code = "geo", group_vars = c("sectperf", "time")),
    to_version = "2021",
    variables = list("values" = "absolute"),
    multiple_versions = "most_frequent"
  )
})
df.conv <- do.call(rbind, conv.list)
rd <- df.conv

rd <- rd[, grepl("code|time|sectperf|values", names(rd))]
colnames(rd)[grep("values", colnames(rd))] <- "rd"

## Keys that should be unique after conversion
key.cols <- c("to_code", "time", "sectperf")

## Count rows per key
library(dplyr)
dup.keys <- rd %>%
  count(across(all_of(key.cols)), name = "n") %>%
  filter(n > 1) %>%
  arrange(desc(n))

## See which combos are duplicated
print(dup.keys, n = 20)

## Show all rows that belong to duplicate keys
rd.dups <- rd %>%
  inner_join(dup.keys, by = key.cols) %>%
  arrange(to_code, time, sectperf)

print(rd.dups, n = 50)


rd.wide <- reshape(
  as.data.frame(rd),
  timevar = "sectperf",
  idvar   = c("to_code", "time"),
  direction = "wide"
)

x <- merge(x, rd.wide, by.x = c("geo", "year"), by.y = c("to_code", "time"),
  all.x = TRUE)

pat.pop <- merge(pat.long, pop.converted,
                 by.x = c("geo","year"),
                 by.y = c("to_code","time"),
                 all.x = TRUE)
## Female unemployment rate (percentage)
female.unemployment <- get_eurostat("lfst_r_lfu3rt",
  time_format = "num", filter = list(sinceTimePeriod = 2008, sex = "F",
  age = "Y15-74", isced11 = "TOTAL"))
female.unemployment <- female.unemployment[nchar(female.unemployment$geo) == 4,
  !(colnames(female.unemployment) %in% c("freq",
  "isced11", "unit", "sex", "age"))]

## Population density (inhabitants per km2)
population.density <- get_eurostat("demo_r_d3dens",
  time_format = "num", filter = list(sinceTimePeriod = 2008))
population.density <- population.density[nchar(population.density$geo) == 4,
  !(colnames(population.density) %in% c("freq", "unit"))]

## sectoral shares (Employment shares of NACE industry as fraction of total employees)
sectoral.shares <- get_eurostat("lfst_r_lfe2en2", time_format = "num",
  filter = list(age = "Y15-64", sex = "T"))
sectoral.shares <- sectoral.shares[nchar(sectoral.shares$geo) == 4, ]
sectoral.shares <- sectoral.shares[, !(colnames(sectoral.shares) %in% c("freq", "age", "sex", "unit"))]
employment <- sectoral.shares
## dataset "wide" machen
agg <- aggregate(values ~ geo + time + nace_r2, data = sectoral.shares, sum, na.rm = TRUE)
wide <- reshape(agg, idvar = c("geo", "time"), timevar = "nace_r2", direction = "wide")

## agricultural share has many NAs which are sometimes real zeroes, sometimes not.
## now calculating agricultural share as
## A = TOTAL − REST where REST := (B–E + F + G–I + J + K + L + M_N + O–Q + R–U + NRP)
## everything but TOTAL and A will be defined as rest columns.
rest.cols <- setdiff(grep("^values\\.", names(wide), value = TRUE),
  c("values.TOTAL", "values.A"))
## if values.NRP is missing then residual would be A + NRP.
## solution: only calculate A if NRP is not NA
has.all.rest <- rowSums(is.na(wide[rest.cols])) == 0
A.res.strict <- ifelse(has.all.rest, wide$values.TOTAL - rowSums(wide[rest.cols]), NA)
## set possible small negative rounding errors to 0
abs.tol <- 1e-3
rel.tol <- 1e-4 # von Total
tol <- pmax(abs.tol, rel.tol * pmax(1, wide$values.TOTAL))
A.res.strict <- ifelse(A.res.strict < 0 & abs(A.res.strict) <= tol * pmax(1, wide$values.TOTAL), 0, A.res.strict)
## only replace missing values of agricultural employment
wide$values.A <- ifelse(is.na(wide$values.A), A.res.strict, wide$values.A)
## sanity check: values should be zero
check <- wide$values.TOTAL - (wide$values.A + rowSums(wide[rest.cols], na.rm = TRUE))
# > summary(check)
#  Min. 1st Qu.  Median    Mean 3rd Qu.    Max.    NA's
# -0.30    0.00    0.10    1.38    1.70   50.30     463

wide$agricultural.share <- wide$values.A / wide$values.TOTAL
wide$manufacturing.share <- (wide$'values.B-E' + wide$values.F) / wide$values.TOTAL
wide$share.rest <- ifelse(wide$values.TOTAL > 0,
  pmax(0, 1 - (wide$agricultural.share + wide$manufacturing.share)), NA)

## calculate Herfindahl Hirschman index (HHI)
## Herfindahl index: sum of squared employment shares over all industries in a given region
## Function to compute HHI for a given region
herfindahl <- function(x) {
  if (!length(x) || sum(x) == 0) return(NA)
  share <- x / sum(x)
  sum(share^2)
}
emp <- as.data.frame(employment)
emp <- emp[emp$nace_r2 != "TOTAL" & is.finite(emp$values) & emp$values >= 0, ]

## 2) HHI-Matrix: region (geo) x year (time)
hhi.mat <- with(emp, tapply(values, list(geo, time), herfindahl))

## long data.frame
hhi <- as.data.frame(as.table(hhi.mat))
names(hhi) <- c("geo", "time", "values")
hhi$time <- as.integer(as.character(hhi$time))
# head(hhi)
#    geo time    values
# 1 AT11 2008 0.1884931
# 2 AT12 2008 0.1670463
# 3 AT13 2008 0.1783037
# 4 AT21 2008 0.1852019
# 5 AT22 2008 0.1769336
# 6 AT31 2008 0.1759761

## import "EU-NED: The European NUTS-Level Election Dataset" (https://doi.org/10.7910/DVN/IQRYP5)
ep <- read.csv("data/eu_ned_ep.csv")
## only nuts 3 level and European election data
ep <- ep[ep$nutslevel >= 2 & ep$type == "EP", ]
ep <- ep[, c("nuts2016", "year", "totalvote", "electorate")]
ep <- unique(ep)
ep <- na.omit(ep)
ep <- ep[ep$electorate > 0, ]
## create turnout variable
ep$turnout <- ep$totalvote / ep$electorate

#
# evs <- grep("Associa", colnames(x)):grep("Strong", colnames(x))
# ##x <- x[complete.cases(x[, -grep("gerd", colnames(x))]), ]


# step by step merge variables into one data.frame x
x <- pat.pop

## merge with population density














## import shape files from data
library("sf")
shapes <- st_read("data/shapefiles/NUTS_RG_03M_2024_4326_LEVL_2.shp/NUTS_RG_03M_2024_4326_LEVL_2.shp",
  quiet = TRUE)
# if any geometries are invalid, correct them
invalid <- !st_is_valid(shapes)
if (any(invalid)) {
  shapes$geometry <- st_make_valid(shapes$geometry)
}

shapes <- shapes[shapes$LEVL_CODE == 2, c("NUTS_ID","CNTR_CODE","NAME_LATN","geometry")]
# str(shapes) # sf object

library("spdep")
# queen neighbors
nb <- poly2nb(shapes, queen = TRUE)
lw.queen <- nb2listw(nb, style = "W", zero.policy = TRUE)

## identify regions with zero neighbors
is.zero <- card(nb) == 0
zero.nuts <- shapes$NUTS_ID[is.zero]
zero.names <- shapes$NAME_LATN[is.zero]
zero_tbl <- data.frame(NUTS_ID = zero.nuts, NAME = zero.names, CNTR = shapes$CNTR_CODE[is.zero])
# > print(zero_tbl) # zero neighbor regions, some more remote than others
#    NUTS_ID                       NAME CNTR
# 1     FRM0                      Corse   FR
# 2     FRY1                 Guadeloupe   FR
# 3     FRY2                 Martinique   FR
# 4     FRY3                     Guyane   FR
# 5     FRY4                 La Réunion   FR
# 6     FRY5                    Mayotte   FR
# 7     FI20                      Åland   FI
# 8     ES53              Illes Balears   ES
# ...

# hybrid neighbors. Queen neighbors mainly. knn only for "islands" and other zero neighbor regions.
# if card > 0 keep using Queen
# if card == 0 use k nearest neighbors with k = 4
shapes.laea <- st_transform(shapes, 3035)
coords <- st_coordinates(st_centroid(shapes.laea))
knn4 <- knn2nb(knearneigh(coords, k = 4))

coords <- st_coordinates(st_centroid(st_geometry(shapes.laea)))
for (k in c(3, 4, 5, 6)) {
  nb_k <- knn2nb(knearneigh(coords, k = k))
  lw_k <- nb2listw(nb_k, style = "W")
    # Beispiel: Moran’s I
  mi <- moran.test(y, lw_k, zero.policy = TRUE)$estimate[1]
  cat("k =", k, " -> Moran's I =", round(mi, 3), "\n")

  # oder: Vergleich der rho-Schätzer im SAR-Modell
  # sar <- lagsarlm(y ~ X, listw = lw_k, zero.policy = TRUE)
  # cat("k =", k, " -> rho =", round(sar$rho, 3), "\n")
}

nb.hybrid <- nb
nb.hybrid[is.zero] <- knn4[is.zero]

lw_hybrid <- nb2listw(nb.hybrid, style = "W")







## citations
# get packages attached via library(), not dependencies
attached.pkgs <- sub("^package:", "", grep("^package:", search(), value = TRUE))

# optional: exclude base packages
attached.pkgs <- setdiff(attached.pkgs, c("base", "stats", "graphics", "grDevices", "utils", "datasets", "methods"))

# create BibTeX file
bibfile <- file("r_libraries.bib", "w")

for (pkg in attached.pkgs) {
  cit <- try(citation(pkg), silent = TRUE)
  if (!inherits(cit, "try-error")) {
    writeLines(toBibtex(cit), bibfile)
  }
}

close(bibfile)

cat("Created file r_libraries.bib with citations for:\n")
print(attached.pkgs)

