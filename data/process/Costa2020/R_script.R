setwd("C:/Multilayer seed dispersal network/Data")

# Correlation between fruit abundance and interaction frequency in each year ####
library(openxlsx)
data.corr<-read.xlsx("Dataset.xlsx",sheet=7,colNames=T)
data.2012<-subset(data.corr, Year=="2012")
data.2013<-subset(data.corr, Year=="2013")
data.2014<-subset(data.corr, Year=="2014")
data.2015<-subset(data.corr, Year=="2015")
data.2016<-subset(data.corr, Year=="2016")

cor.test(data.2012$abundance.fruits, data.2012$int.freq, method="kendall")
cor.test(data.2013$abundance.fruits, data.2013$int.freq, method="kendall")
cor.test(data.2014$abundance.fruits, data.2014$int.freq, method="kendall")
cor.test(data.2015$abundance.fruits, data.2015$int.freq, method="kendall")
cor.test(data.2016$abundance.fruits, data.2016$int.freq, method="kendall")

# Read species interaction matrices ####
# Save each of the first five  sheets from the "Dataset.xlsx" as comma separated files (.csv)
# and then import each one as a matrix
VS12web <- as.matrix (read.table("VS12.csv", header =T, row.names= 1, sep=",", dec="."))
VS13web <- as.matrix (read.table("VS13.csv", header =T, row.names= 1, sep=",", dec="."))
VS14web <- as.matrix (read.table("VS14.csv", header =T, row.names= 1, sep=",", dec="."))
VS15web <- as.matrix (read.table("VS15.csv", header =T, row.names= 1, sep=",", dec="."))
VS16web <- as.matrix (read.table("VS16.csv", header =T, row.names= 1, sep=",", dec="."))

# Compute network dissimilarities between consecutive years ####
library(betalink)
multilayer<-list(VS12web,VS13web,VS14web,VS15web,VS16web)
networks<-prepare_networks(multilayer, directed = TRUE)
betalink(networks[[1]],networks[[2]], bf = B01) #B01 is the Whittaker beta-diversity index
betalink(networks[[2]],networks[[3]], bf = B01)
betalink(networks[[3]],networks[[4]], bf = B01)
betalink(networks[[4]],networks[[5]], bf = B01)

# Compute connectance, nestedness (WIN), and network specialization H2' across the years ####
library(bipartite)

win2012<-wine(VS12web)$win #nestedness for the 2012 network
names(win2012)<-"Nestedness"
win2013<-wine(VS13web)$win #nestedness for the 2013 network
names(win2013)<-"Nestedness"
win2014<-wine(VS14web)$win #nestedness for the 2014 network
names(win2014)<-"Nestedness"
win2015<-wine(VS15web)$win #nestedness for the 2015 network
names(win2015)<-"Nestedness"
win2016<-wine(VS16web)$win #nestedness for the 2016 network
names(win2016)<-"Nestedness"

Observed.2012<-c(networklevel(VS12web)[1],networklevel(VS12web)[19],win2012)
#networklevel(VS12web)[1]=connectance; networklevel(VS12web)[19]=network specialization H2'
Observed.2013<-c(networklevel(VS13web)[1],networklevel(VS13web)[19],win2013)
Observed.2014<-c(networklevel(VS14web)[1],networklevel(VS14web)[19],win2014)
Observed.2015<-c(networklevel(VS15web)[1],networklevel(VS15web)[19],win2015)
Observed.2016<-c(networklevel(VS16web)[1],networklevel(VS16web)[19],win2016)

# Create 1000 null models with the Patefield algorithm ####
# 2012
nulls12<-nullmodel(VS12web,N=1000,method=1)

# Connectance
null12Connectance <- unlist(sapply(nulls12, networklevel, index="connectance"))
null12Connectance.mean<-mean(null12Connectance)
null12Connectance.sd<-sd(null12Connectance)
z.score.Connectance12<-(networklevel(VS12web)[1]-null12Connectance.mean)/null12Connectance.sd #calculate z-score
names(null12Connectance.mean)<-"mean null model"
names(null12Connectance.sd)<-"SD null model"
names(z.score.Connectance12)<-"z score"
sorted1<-sort(null12Connectance)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
Connectance12null<-c(Percentile.2.5.null1,null12Connectance.mean,Percentile.97.5.null1,null12Connectance.sd,z.score.Connectance12)

# Weighted nestedness (WIN)
Null.nestedness.2012<- vector("list",1000)
for(i in 1:1000){Null.nestedness.2012[[i]]<-sapply(nulls12, wine)[,i]$win} # it takes a while...
Null.nestedness.2012<-t(as.data.frame(Null.nestedness.2012))
colnames(Null.nestedness.2012)<-c("Null.nestedness.2012")
Null.nestedness.2012<-as.numeric(as.character(unlist(Null.nestedness.2012)))
null12.nestedness.mean<-mean(Null.nestedness.2012)
null12.nestedness.sd<-sd(Null.nestedness.2012)
z.score.nestedness.12<-(win2012-null12.nestedness.mean)/null12.nestedness.sd #calculate z-score
names(null12.nestedness.mean)<-"mean null model"
names(null12.nestedness.sd)<-"SD null model"
names(z.score.nestedness.12)<-"z score"
sorted<-sort(Null.nestedness.2012)
Percentile.2.5.null<-quantile(sorted,.025)
Percentile.97.5.null<-quantile(sorted,.975)
Nestedness.12null<-c(Percentile.2.5.null,null12.nestedness.mean,Percentile.97.5.null,null12.nestedness.sd,z.score.nestedness.12)

# H2'
null12.H2 <- unlist(sapply(nulls12, networklevel, index="H2"))
null12.H2.mean<-mean(null12.H2)
null12.H2.sd<-sd(null12.H2)
z.score.H2.12<-(networklevel(VS12web)[19]-null12.H2.mean)/null12.H2.sd #calculate z-score
names(null12.H2.mean)<-"mean null model"
names(null12.H2.sd)<-"SD null model"
names(z.score.H2.12)<-"z score"
sorted1<-sort(null12.H2)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
H2.12null<-c(Percentile.2.5.null1,null12.H2.mean,Percentile.97.5.null1,null12.H2.sd,z.score.H2.12)

Null2012<-rbind(Connectance12null,Nestedness.12null,H2.12null)

# 2013
nulls13<-nullmodel(VS13web,N=1000,method=1)

# Connectance
null13Connectance <- unlist(sapply(nulls13, networklevel, index="connectance"))
null13Connectance.mean<-mean(null13Connectance)
null13Connectance.sd<-sd(null13Connectance)
z.score.Connectance13<-(networklevel(VS13web)[1]-null13Connectance.mean)/null13Connectance.sd #calculate z-score
names(null13Connectance.mean)<-"mean null model"
names(null13Connectance.sd)<-"SD null model"
names(z.score.Connectance13)<-"z score"
sorted1<-sort(null13Connectance)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
Connectance13null<-c(Percentile.2.5.null1,null13Connectance.mean,Percentile.97.5.null1,null13Connectance.sd,z.score.Connectance13)

# Weighted nestedness (WIN)
Null.nestedness.2013<- vector("list",1000)
for(i in 1:1000){Null.nestedness.2013[[i]]<-sapply(nulls13, wine)[,i]$win}
Null.nestedness.2013<-t(as.data.frame(Null.nestedness.2013))
colnames(Null.nestedness.2013)<-c("Null.nestedness.2013")
Null.nestedness.2013<-as.numeric(as.character(unlist(Null.nestedness.2013)))
null13.nestedness.mean<-mean(Null.nestedness.2013)
null13.nestedness.sd<-sd(Null.nestedness.2013)
z.score.nestedness.13<-(win2013-null13.nestedness.mean)/null13.nestedness.sd #calculate z-score
names(null13.nestedness.mean)<-"mean null model"
names(null13.nestedness.sd)<-"SD null model"
names(z.score.nestedness.13)<-"z score"
sorted<-sort(Null.nestedness.2013)
Percentile.2.5.null<-quantile(sorted,.025)
Percentile.97.5.null<-quantile(sorted,.975)
Nestedness.13null<-c(Percentile.2.5.null,null13.nestedness.mean,Percentile.97.5.null,null13.nestedness.sd,z.score.nestedness.13)

# H2'
null13.H2 <- unlist(sapply(nulls13, networklevel, index="H2"))
null13.H2.mean<-mean(null13.H2)
null13.H2.sd<-sd(null13.H2)
z.score.H2.13<-(networklevel(VS13web)[19]-null13.H2.mean)/null13.H2.sd #calculate z-score
names(null13.H2.mean)<-"mean null model"
names(null13.H2.sd)<-"SD null model"
names(z.score.H2.13)<-"z score"
sorted1<-sort(null13.H2)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
H2.13null<-c(Percentile.2.5.null1,null13.H2.mean,Percentile.97.5.null1,null13.H2.sd,z.score.H2.13)

Null2013<-rbind(Connectance13null,Nestedness.13null,H2.13null)

# 2014
nulls14<-nullmodel(VS14web,N=1000,method=1)

# Connectance
null14Connectance <- unlist(sapply(nulls14, networklevel, index="connectance"))
null14Connectance.mean<-mean(null14Connectance)
null14Connectance.sd<-sd(null14Connectance)
z.score.Connectance14<-(networklevel(VS14web)[1]-null14Connectance.mean)/null14Connectance.sd #calculate z-score
names(null14Connectance.mean)<-"mean null model"
names(null14Connectance.sd)<-"SD null model"
names(z.score.Connectance14)<-"z score"
sorted1<-sort(null14Connectance)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
Connectance14null<-c(Percentile.2.5.null1,null14Connectance.mean,Percentile.97.5.null1,null14Connectance.sd,z.score.Connectance14)

# Weighted nestedness (WIN)
Null.nestedness.2014<- vector("list",1000)
for(i in 1:1000){Null.nestedness.2014[[i]]<-sapply(nulls14, wine)[,i]$win}
Null.nestedness.2014<-t(as.data.frame(Null.nestedness.2014))
colnames(Null.nestedness.2014)<-c("Null.nestedness.2014")
Null.nestedness.2014<-as.numeric(as.character(unlist(Null.nestedness.2014)))
null14.nestedness.mean<-mean(Null.nestedness.2014)
null14.nestedness.sd<-sd(Null.nestedness.2014)
z.score.nestedness.14<-(win2014-null14.nestedness.mean)/null14.nestedness.sd #calculate z-score
names(null14.nestedness.mean)<-"mean null model"
names(null14.nestedness.sd)<-"SD null model"
names(z.score.nestedness.14)<-"z score"
sorted<-sort(Null.nestedness.2014)
Percentile.2.5.null<-quantile(sorted,.025)
Percentile.97.5.null<-quantile(sorted,.975)
Nestedness.14null<-c(Percentile.2.5.null,null14.nestedness.mean,Percentile.97.5.null,null14.nestedness.sd,z.score.nestedness.14)

# H2'
null14.H2 <- unlist(sapply(nulls14, networklevel, index="H2"))
null14.H2.mean<-mean(null14.H2)
null14.H2.sd<-sd(null14.H2)
z.score.H2.14<-(networklevel(VS14web)[19]-null14.H2.mean)/null14.H2.sd #calculate z-score
names(null14.H2.mean)<-"mean null model"
names(null14.H2.sd)<-"SD null model"
names(z.score.H2.14)<-"z score"
sorted1<-sort(null14.H2)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
H2.14null<-c(Percentile.2.5.null1,null14.H2.mean,Percentile.97.5.null1,null14.H2.sd,z.score.H2.14)

Null2014<-rbind(Connectance14null,Nestedness.14null,H2.14null)

# 2015
nulls15<-nullmodel(VS15web,N=1000,method=1)

# Connectance
null15Connectance <- unlist(sapply(nulls15, networklevel, index="connectance"))
null15Connectance.mean<-mean(null15Connectance)
null15Connectance.sd<-sd(null15Connectance)
z.score.Connectance15<-(networklevel(VS15web)[1]-null15Connectance.mean)/null15Connectance.sd #calculate z-score
names(null15Connectance.mean)<-"mean null model"
names(null15Connectance.sd)<-"SD null model"
names(z.score.Connectance15)<-"z score"
sorted1<-sort(null15Connectance)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
Connectance15null<-c(Percentile.2.5.null1,null15Connectance.mean,Percentile.97.5.null1,null15Connectance.sd,z.score.Connectance15)

# Weighted nestedness (WIN)
Null.nestedness.2015<- vector("list",1000)
for(i in 1:1000){Null.nestedness.2015[[i]]<-sapply(nulls15, wine)[,i]$win}
Null.nestedness.2015<-t(as.data.frame(Null.nestedness.2015))
colnames(Null.nestedness.2015)<-c("Null.nestedness.2015")
Null.nestedness.2015<-as.numeric(as.character(unlist(Null.nestedness.2015)))
null15.nestedness.mean<-mean(Null.nestedness.2015)
null15.nestedness.sd<-sd(Null.nestedness.2015)
z.score.nestedness.15<-(win2015-null15.nestedness.mean)/null15.nestedness.sd #calculate z-score
names(null15.nestedness.mean)<-"mean null model"
names(null15.nestedness.sd)<-"SD null model"
names(z.score.nestedness.15)<-"z score"
sorted<-sort(Null.nestedness.2015)
Percentile.2.5.null<-quantile(sorted,.025)
Percentile.97.5.null<-quantile(sorted,.975)
Nestedness.15null<-c(Percentile.2.5.null,null15.nestedness.mean,Percentile.97.5.null,null15.nestedness.sd,z.score.nestedness.15)

# H2'
null15.H2 <- unlist(sapply(nulls15, networklevel, index="H2"))
null15.H2.mean<-mean(null15.H2)
null15.H2.sd<-sd(null15.H2)
z.score.H2.15<-(networklevel(VS15web)[19]-null15.H2.mean)/null15.H2.sd #calculate z-score
names(null15.H2.mean)<-"mean null model"
names(null15.H2.sd)<-"SD null model"
names(z.score.H2.15)<-"z score"
sorted1<-sort(null15.H2)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
H2.15null<-c(Percentile.2.5.null1,null15.H2.mean,Percentile.97.5.null1,null15.H2.sd,z.score.H2.15)

Null2015<-rbind(Connectance15null,Nestedness.15null,H2.15null)

# 2016
nulls16<-nullmodel(VS16web,N=1000,method=1)

# Connectance
null16Connectance <- unlist(sapply(nulls16, networklevel, index="connectance"))
null16Connectance.mean<-mean(null16Connectance)
null16Connectance.sd<-sd(null16Connectance)
z.score.Connectance16<-(networklevel(VS16web)[1]-null16Connectance.mean)/null16Connectance.sd #calculate z-score
names(null16Connectance.mean)<-"mean null model"
names(null16Connectance.sd)<-"SD null model"
names(z.score.Connectance16)<-"z score"
sorted1<-sort(null16Connectance)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
Connectance16null<-c(Percentile.2.5.null1,null16Connectance.mean,Percentile.97.5.null1,null16Connectance.sd,z.score.Connectance16)

# Weighted nestedness (WIN)
Null.nestedness.2016<- vector("list",1000)
for(i in 1:1000){Null.nestedness.2016[[i]]<-sapply(nulls16, wine)[,i]$win}
Null.nestedness.2016<-t(as.data.frame(Null.nestedness.2016))
colnames(Null.nestedness.2016)<-c("Null.nestedness.2016")
Null.nestedness.2016<-as.numeric(as.character(unlist(Null.nestedness.2016)))
null16.nestedness.mean<-mean(Null.nestedness.2016)
null16.nestedness.sd<-sd(Null.nestedness.2016)
z.score.nestedness.16<-(win2016-null16.nestedness.mean)/null16.nestedness.sd #calculate z-score
names(null16.nestedness.mean)<-"mean null model"
names(null16.nestedness.sd)<-"SD null model"
names(z.score.nestedness.16)<-"z score"
sorted<-sort(Null.nestedness.2016)
Percentile.2.5.null<-quantile(sorted,.025)
Percentile.97.5.null<-quantile(sorted,.975)
Nestedness.16null<-c(Percentile.2.5.null,null16.nestedness.mean,Percentile.97.5.null,null16.nestedness.sd,z.score.nestedness.16)

# H2'
null16.H2 <- unlist(sapply(nulls16, networklevel, index="H2"))
null16.H2.mean<-mean(null16.H2)
null16.H2.sd<-sd(null16.H2)
z.score.H2.16<-(networklevel(VS16web)[19]-null16.H2.mean)/null16.H2.sd #calculate z-score
names(null16.H2.mean)<-"mean null model"
names(null16.H2.sd)<-"SD null model"
names(z.score.H2.16)<-"z score"
sorted1<-sort(null16.H2)
Percentile.2.5.null1<-quantile(sorted1,.025)
Percentile.97.5.null1<-quantile(sorted1,.975)
H2.16null<-c(Percentile.2.5.null1,null16.H2.mean,Percentile.97.5.null1,null16.H2.sd,z.score.H2.16)

Null2016<-rbind(Connectance16null,Nestedness.16null,H2.16null)




# Export data to compute multilayer species centrality (versatility) in MuxViz ####
library(tnet)
# Plants 2012
one.mode12<-web2edges(VS12web,return=TRUE)
plants2012<-projecting_tm(one.mode12, method="Newman")
targeti <- which(names(plants2012) == 'i')[1]
plants2012.1<-cbind(plants2012[,1:targeti,drop=F], data.frame(year=rep(2012,94)), plants2012[,(targeti+1):length(plants2012),drop=F])
targetj <- which(names(plants2012.1) == 'j')[1]
plants2012<-cbind(plants2012.1[,1:targetj,drop=F], data.frame(year=rep(2012,94)), plants2012.1[,(targetj+1):length(plants2012.1),drop=F])
plants2012$i<-as.character(plants2012$i)
plants2012$i[plants2012$i == "1"] <- "Arbutus_unedo"
plants2012$i[plants2012$i == "2"] <- "Daphne_gnidium"
plants2012$i[plants2012$i == "3"] <- "Ficus_carica"
plants2012$i[plants2012$i == "4"] <- "Olea_europaea"
plants2012$i[plants2012$i == "5"] <- "Phytolacca_americana"
plants2012$i[plants2012$i == "6"] <- "Pistacia_lentiscus"
plants2012$i[plants2012$i == "7"] <- "Rhamnus_alaternus"
plants2012$i[plants2012$i == "8"] <- "Rubia_peregrina"
plants2012$i[plants2012$i == "9"] <- "Rubus_ulmifolius"
plants2012$i[plants2012$i == "10"] <- "Smilax_aspera"
plants2012$i[plants2012$i == "11"] <- "Solanum_nigrum"
plants2012$i[plants2012$i == "12"] <- "Vitis_vinifera"

plants2012$j<-as.character(plants2012$j)
plants2012$j[plants2012$j == "1"] <- "Arbutus_unedo"
plants2012$j[plants2012$j == "2"] <- "Daphne_gnidium"
plants2012$j[plants2012$j == "3"] <- "Ficus_carica"
plants2012$j[plants2012$j == "4"] <- "Olea_europaea"
plants2012$j[plants2012$j == "5"] <- "Phytolacca_americana"
plants2012$j[plants2012$j == "6"] <- "Pistacia_lentiscus"
plants2012$j[plants2012$j == "7"] <- "Rhamnus_alaternus"
plants2012$j[plants2012$j == "8"] <- "Rubia_peregrina"
plants2012$j[plants2012$j == "9"] <- "Rubus_ulmifolius"
plants2012$j[plants2012$j == "10"] <- "Smilax_aspera"
plants2012$j[plants2012$j == "11"] <- "Solanum_nigrum"
plants2012$j[plants2012$j == "12"] <- "Vitis_vinifera"

write.table(plants2012, file = "C:/Multilayer seed dispersal network/Data/one.mode.plants.2012.txt", sep= " ", col.names = NA)

# Birds 2012
birds.2012<-t(VS12web)
one.mode12<-web2edges(birds.2012,return=TRUE)
birds2012<-projecting_tm(one.mode12, method="Newman")
targeti <- which(names(birds2012) == 'i')[1]
birds2012.1<-cbind(birds2012[,1:targeti,drop=F], data.frame(year=rep(2012,56)), birds2012[,(targeti+1):length(birds2012),drop=F])
targetj <- which(names(birds2012.1) == 'j')[1]
birds2012<-cbind(birds2012.1[,1:targetj,drop=F], data.frame(year=rep(2012,56)), birds2012.1[,(targetj+1):length(birds2012.1),drop=F])
birds2012$i<-as.character(birds2012$i)
birds2012$i[birds2012$i == "1"] <- "Cyanistes_caeruleus"
birds2012$i[birds2012$i == "2"] <- "Erithacus_rubecula"
birds2012$i[birds2012$i == "3"] <- "Ficedula_hypoleuca"
birds2012$i[birds2012$i == "4"] <- "Sylvia_atricapilla"
birds2012$i[birds2012$i == "5"] <- "Sylvia_borin"
birds2012$i[birds2012$i == "6"] <- "Sylvia_communis"
birds2012$i[birds2012$i == "7"] <- "Sylvia_melanocephala"
birds2012$i[birds2012$i == "8"] <- "Turdus_merula"

birds2012$j<-as.character(birds2012$j)
birds2012$j[birds2012$j == "1"] <- "Cyanistes_caeruleus"
birds2012$j[birds2012$j == "2"] <- "Erithacus_rubecula"
birds2012$j[birds2012$j == "3"] <- "Ficedula_hypoleuca"
birds2012$j[birds2012$j == "4"] <- "Sylvia_atricapilla"
birds2012$j[birds2012$j == "5"] <- "Sylvia_borin"
birds2012$j[birds2012$j == "6"] <- "Sylvia_communis"
birds2012$j[birds2012$j == "7"] <- "Sylvia_melanocephala"
birds2012$j[birds2012$j == "8"] <- "Turdus_merula"

write.table(birds2012, file = "C:/Multilayer seed dispersal network/Data/one.mode.birds.2012.txt", sep= " ", col.names = NA)

# Plants 2013
one.mode13<-web2edges(VS13web,return=TRUE)
plants2013<-projecting_tm(one.mode13, method="Newman")
targeti <- which(names(plants2013) == 'i')[1]
plants2013.1<-cbind(plants2013[,1:targeti,drop=F], data.frame(year=rep(2013,48)), plants2013[,(targeti+1):length(plants2013),drop=F])
targetj <- which(names(plants2013.1) == 'j')[1]
plants2013<-cbind(plants2013.1[,1:targetj,drop=F], data.frame(year=rep(2013,48)), plants2013.1[,(targetj+1):length(plants2013.1),drop=F])
plants2013$i<-as.character(plants2013$i)
plants2013$i[plants2013$i == "1"] <- "Ficus_carica"
plants2013$i[plants2013$i == "2"] <- "Lonicera_periclymenum"
plants2013$i[plants2013$i == "3"] <- "Phillyrea_latifolia"
plants2013$i[plants2013$i == "4"] <- "Rhamnus_alaternus"
plants2013$i[plants2013$i == "5"] <- "Rubus_ulmifolius"
plants2013$i[plants2013$i == "6"] <- "Smilax_aspera"
plants2013$i[plants2013$i == "7"] <- "Solanum_nigrum"
plants2013$i[plants2013$i == "8"] <- "Vitis_vinifera"

plants2013$j<-as.character(plants2013$j)
plants2013$j[plants2013$j == "1"] <- "Ficus_carica"
plants2013$j[plants2013$j == "2"] <- "Lonicera_periclymenum"
plants2013$j[plants2013$j == "3"] <- "Phillyrea_latifolia"
plants2013$j[plants2013$j == "4"] <- "Rhamnus_alaternus"
plants2013$j[plants2013$j == "5"] <- "Rubus_ulmifolius"
plants2013$j[plants2013$j == "6"] <- "Smilax_aspera"
plants2013$j[plants2013$j == "7"] <- "Solanum_nigrum"
plants2013$j[plants2013$j == "8"] <- "Vitis_vinifera"
write.table(plants2013, file = "C:/Multilayer seed dispersal network/Data/one.mode.plants.2013.txt", sep= " ", col.names = NA)

# Birds 2013
birds.2013<-t(VS13web)
one.mode13<-web2edges(birds.2013,return=TRUE)
birds2013<-projecting_tm(one.mode13, method="Newman")
targeti <- which(names(birds2013) == 'i')[1]
birds2013.1<-cbind(birds2013[,1:targeti,drop=F], data.frame(year=rep(2013,38)), birds2013[,(targeti+1):length(birds2013),drop=F])
targetj <- which(names(birds2013.1) == 'j')[1]
birds2013<-cbind(birds2013.1[,1:targetj,drop=F], data.frame(year=rep(2013,38)), birds2013.1[,(targetj+1):length(birds2013.1),drop=F])
birds2013$i<-as.character(birds2013$i)
birds2013$i[birds2013$i == "1"] <- "Cyanistes_caeruleus"
birds2013$i[birds2013$i == "2"] <- "Erithacus_rubecula"
birds2013$i[birds2013$i == "3"] <- "Ficedula_hypoleuca"
birds2013$i[birds2013$i == "4"] <- "Sylvia_atricapilla"
birds2013$i[birds2013$i == "5"] <- "Sylvia_borin"
birds2013$i[birds2013$i == "6"] <- "Sylvia_melanocephala"
birds2013$i[birds2013$i == "7"] <- "Turdus_merula"

birds2013$j<-as.character(birds2013$j)
birds2013$j[birds2013$j == "1"] <- "Cyanistes_caeruleus"
birds2013$j[birds2013$j == "2"] <- "Erithacus_rubecula"
birds2013$j[birds2013$j == "3"] <- "Ficedula_hypoleuca"
birds2013$j[birds2013$j == "4"] <- "Sylvia_atricapilla"
birds2013$j[birds2013$j == "5"] <- "Sylvia_borin"
birds2013$j[birds2013$j == "6"] <- "Sylvia_melanocephala"
birds2013$j[birds2013$j == "7"] <- "Turdus_merula"

write.table(birds2013, file = "C:/Multilayer seed dispersal network/Data/one.mode.birds.2013.txt", sep= " ", col.names = NA)

# Plants 2014
one.mode14<-web2edges(VS14web,return=TRUE)
plants2014<-projecting_tm(one.mode14, method="Newman")
targeti <- which(names(plants2014) == 'i')[1]
plants2014.1<-cbind(plants2014[,1:targeti,drop=F], data.frame(year=rep(2014,100)), plants2014[,(targeti+1):length(plants2014),drop=F])
targetj <- which(names(plants2014.1) == 'j')[1]
plants2014<-cbind(plants2014.1[,1:targetj,drop=F], data.frame(year=rep(2014,100)), plants2014.1[,(targetj+1):length(plants2014.1),drop=F])
plants2014$i<-as.character(plants2014$i)
plants2014$i[plants2014$i == "1"] <- "Arbutus_unedo"
plants2014$i[plants2014$i == "2"] <- "Daphne_gnidium"
plants2014$i[plants2014$i == "3"] <- "Ficus_carica"
plants2014$i[plants2014$i == "4"] <- "Phillyrea_latifolia"
plants2014$i[plants2014$i == "5"] <- "Pistacia_lentiscus"
plants2014$i[plants2014$i == "6"] <- "Rhamnus_alaternus"
plants2014$i[plants2014$i == "7"] <- "Rubia_peregrina"
plants2014$i[plants2014$i == "8"] <- "Rubus_ulmifolius"
plants2014$i[plants2014$i == "9"] <- "Smilax_aspera"
plants2014$i[plants2014$i == "10"] <- "Solanum_nigrum"
plants2014$i[plants2014$i == "11"] <- "Viburnum_tinus"
plants2014$i[plants2014$i == "12"] <- "Vitis_vinifera"

plants2014$j<-as.character(plants2014$j)
plants2014$j[plants2014$j == "1"] <- "Arbutus_unedo"
plants2014$j[plants2014$j == "2"] <- "Daphne_gnidium"
plants2014$j[plants2014$j == "3"] <- "Ficus_carica"
plants2014$j[plants2014$j == "4"] <- "Phillyrea_latifolia"
plants2014$j[plants2014$j == "5"] <- "Pistacia_lentiscus"
plants2014$j[plants2014$j == "6"] <- "Rhamnus_alaternus"
plants2014$j[plants2014$j == "7"] <- "Rubia_peregrina"
plants2014$j[plants2014$j == "8"] <- "Rubus_ulmifolius"
plants2014$j[plants2014$j == "9"] <- "Smilax_aspera"
plants2014$j[plants2014$j == "10"] <- "Solanum_nigrum"
plants2014$j[plants2014$j == "11"] <- "Viburnum_tinus"
plants2014$j[plants2014$j == "12"] <- "Vitis_vinifera"
write.table(plants2014, file = "C:/Multilayer seed dispersal network/Data/one.mode.plants.2014.txt", sep= " ", col.names = NA)

# Birds 2014
birds.2014<-t(VS14web)
one.mode14<-web2edges(birds.2014,return=TRUE)
birds2014<-projecting_tm(one.mode14, method="Newman")
targeti <- which(names(birds2014) == 'i')[1]
birds2014.1<-cbind(birds2014[,1:targeti,drop=F], data.frame(year=rep(2014,72)), birds2014[,(targeti+1):length(birds2014),drop=F])
targetj <- which(names(birds2014.1) == 'j')[1]
birds2014<-cbind(birds2014.1[,1:targetj,drop=F], data.frame(year=rep(2014,72)), birds2014.1[,(targetj+1):length(birds2014.1),drop=F])
birds2014$i<-as.character(birds2014$i)
birds2014$i[birds2014$i == "1"] <- "Cyanistes_caeruleus"
birds2014$i[birds2014$i == "2"] <- "Dendrocopos_major"
birds2014$i[birds2014$i == "3"] <- "Erithacus_rubecula"
birds2014$i[birds2014$i == "4"] <- "Ficedula_hypoleuca"
birds2014$i[birds2014$i == "5"] <- "Muscicapa_striata"
birds2014$i[birds2014$i == "6"] <- "Sylvia_atricapilla"
birds2014$i[birds2014$i == "7"] <- "Sylvia_borin"
birds2014$i[birds2014$i == "8"] <- "Sylvia_communis"
birds2014$i[birds2014$i == "9"] <- "Sylvia_melanocephala"
birds2014$i[birds2014$i == "10"] <- "Sylvia_undata"
birds2014$i[birds2014$i == "11"] <- "Turdus_merula"

birds2014$j<-as.character(birds2014$j)
birds2014$j[birds2014$j == "1"] <- "Cyanistes_caeruleus"
birds2014$j[birds2014$j == "2"] <- "Dendrocopos_major"
birds2014$j[birds2014$j == "3"] <- "Erithacus_rubecula"
birds2014$j[birds2014$j == "4"] <- "Ficedula_hypoleuca"
birds2014$j[birds2014$j == "5"] <- "Muscicapa_striata"
birds2014$j[birds2014$j == "6"] <- "Sylvia_atricapilla"
birds2014$j[birds2014$j == "7"] <- "Sylvia_borin"
birds2014$j[birds2014$j == "8"] <- "Sylvia_communis"
birds2014$j[birds2014$j == "9"] <- "Sylvia_melanocephala"
birds2014$j[birds2014$j == "10"] <- "Sylvia_undata"
birds2014$j[birds2014$j == "11"] <- "Turdus_merula"

write.table(birds2014, file = "C:/Multilayer seed dispersal network/Data/one.mode.birds.2014.txt", sep= " ", col.names = NA)

# Plants 2015
one.mode15<-web2edges(VS15web,return=TRUE)
plants2015<-projecting_tm(one.mode15, method="Newman")
targeti <- which(names(plants2015) == 'i')[1]
plants2015.1<-cbind(plants2015[,1:targeti,drop=F], data.frame(year=rep(2015,164)), plants2015[,(targeti+1):length(plants2015),drop=F])
targetj <- which(names(plants2015.1) == 'j')[1]
plants2015<-cbind(plants2015.1[,1:targetj,drop=F], data.frame(year=rep(2015,164)), plants2015.1[,(targetj+1):length(plants2015.1),drop=F])
plants2015$i<-as.character(plants2015$i)
plants2015$i[plants2015$i == "1"] <- "Arbutus_unedo"
plants2015$i[plants2015$i == "2"] <- "Ficus_carica"
plants2015$i[plants2015$i == "3"] <- "Lonicera_periclymenum"
plants2015$i[plants2015$i == "4"] <- "Phillyrea_angustifolia"
plants2015$i[plants2015$i == "5"] <- "Phillyrea_latifolia"
plants2015$i[plants2015$i == "6"] <- "Phytolacca_americana"
plants2015$i[plants2015$i == "7"] <- "Pistacia_lentiscus"
plants2015$i[plants2015$i == "8"] <- "Rhamnus_alaternus"
plants2015$i[plants2015$i == "9"] <- "Rubia_peregrina"
plants2015$i[plants2015$i == "10"] <- "Rubus_ulmifolius"
plants2015$i[plants2015$i == "11"] <- "Smilax_aspera"
plants2015$i[plants2015$i == "12"] <- "Solanum_nigrum"
plants2015$i[plants2015$i == "13"] <- "Viburnum_tinus"
plants2015$i[plants2015$i == "14"] <- "Vitis_vinifera"

plants2015$j<-as.character(plants2015$j)
plants2015$j[plants2015$j == "1"] <- "Arbutus_unedo"
plants2015$j[plants2015$j == "2"] <- "Ficus_carica"
plants2015$j[plants2015$j == "3"] <- "Lonicera_periclymenum"
plants2015$j[plants2015$j == "4"] <- "Phillyrea_angustifolia"
plants2015$j[plants2015$j == "5"] <- "Phillyrea_latifolia"
plants2015$j[plants2015$j == "6"] <- "Phytolacca_americana"
plants2015$j[plants2015$j == "7"] <- "Pistacia_lentiscus"
plants2015$j[plants2015$j == "8"] <- "Rhamnus_alaternus"
plants2015$j[plants2015$j == "9"] <- "Rubia_peregrina"
plants2015$j[plants2015$j == "10"] <- "Rubus_ulmifolius"
plants2015$j[plants2015$j == "11"] <- "Smilax_aspera"
plants2015$j[plants2015$j == "12"] <- "Solanum_nigrum"
plants2015$j[plants2015$j == "13"] <- "Viburnum_tinus"
plants2015$j[plants2015$j == "14"] <- "Vitis_vinifera"
write.table(plants2015, file = "C:/Multilayer seed dispersal network/Data/one.mode.plants.2015.txt", sep= " ", col.names = NA)

# Birds 2015
birds.2015<-t(VS15web)
one.mode15<-web2edges(birds.2015,return=TRUE)
birds2015<-projecting_tm(one.mode15, method="Newman")
targeti <- which(names(birds2015) == 'i')[1]
birds2015.1<-cbind(birds2015[,1:targeti,drop=F], data.frame(year=rep(2015,76)), birds2015[,(targeti+1):length(birds2015),drop=F])
targetj <- which(names(birds2015.1) == 'j')[1]
birds2015<-cbind(birds2015.1[,1:targetj,drop=F], data.frame(year=rep(2015,76)), birds2015.1[,(targetj+1):length(birds2015.1),drop=F])
birds2015$i<-as.character(birds2015$i)
birds2015$i[birds2015$i == "1"] <- "Chloris_chloris"
birds2015$i[birds2015$i == "2"] <- "Erithacus_rubecula"
birds2015$i[birds2015$i == "3"] <- "Ficedula_hypoleuca"
birds2015$i[birds2015$i == "4"] <- "Muscicapa_striata"
birds2015$i[birds2015$i == "5"] <- "Sylvia_atricapilla"
birds2015$i[birds2015$i == "6"] <- "Sylvia_borin"
birds2015$i[birds2015$i == "7"] <- "Sylvia_communis"
birds2015$i[birds2015$i == "8"] <- "Sylvia_melanocephala"
birds2015$i[birds2015$i == "9"] <- "Sylvia_undata"
birds2015$i[birds2015$i == "10"] <- "Turdus_merula"

birds2015$j<-as.character(birds2015$j)
birds2015$j[birds2015$j == "1"] <- "Chloris_chloris"
birds2015$j[birds2015$j == "2"] <- "Erithacus_rubecula"
birds2015$j[birds2015$j == "3"] <- "Ficedula_hypoleuca"
birds2015$j[birds2015$j == "4"] <- "Muscicapa_striata"
birds2015$j[birds2015$j == "5"] <- "Sylvia_atricapilla"
birds2015$j[birds2015$j == "6"] <- "Sylvia_borin"
birds2015$j[birds2015$j == "7"] <- "Sylvia_communis"
birds2015$j[birds2015$j == "8"] <- "Sylvia_melanocephala"
birds2015$j[birds2015$j == "9"] <- "Sylvia_undata"
birds2015$j[birds2015$j == "10"] <- "Turdus_merula"
write.table(birds2015, file = "C:/Multilayer seed dispersal network/Data/one.mode.birds.2015.txt", sep= " ", col.names = NA)

# Plants 2016
one.mode16<-web2edges(VS16web,return=TRUE)
plants2016<-projecting_tm(one.mode16, method="Newman")
targeti <- which(names(plants2016) == 'i')[1]
plants2016.1<-cbind(plants2016[,1:targeti,drop=F], data.frame(year=rep(2016,78)), plants2016[,(targeti+1):length(plants2016),drop=F])
targetj <- which(names(plants2016.1) == 'j')[1]
plants2016<-cbind(plants2016.1[,1:targetj,drop=F], data.frame(year=rep(2016,78)), plants2016.1[,(targetj+1):length(plants2016.1),drop=F])
plants2016$i<-as.character(plants2016$i)
plants2016$i[plants2016$i == "1"] <- "Crataegus_monogyna"
plants2016$i[plants2016$i == "2"] <- "Daphne_gnidium"
plants2016$i[plants2016$i == "3"] <- "Ficus_carica"
plants2016$i[plants2016$i == "4"] <- "Lonicera_periclymenum"
plants2016$i[plants2016$i == "5"] <- "Phillyrea_latifolia"
plants2016$i[plants2016$i == "6"] <- "Phytolacca_americana"
plants2016$i[plants2016$i == "7"] <- "Rhamnus_alaternus"
plants2016$i[plants2016$i == "8"] <- "Rubus_ulmifolius"
plants2016$i[plants2016$i == "9"] <- "Smilax_aspera"
plants2016$i[plants2016$i == "10"] <- "Vitis_vinifera"

plants2016$j<-as.character(plants2016$j)
plants2016$j[plants2016$j == "1"] <- "Crataegus_monogyna"
plants2016$j[plants2016$j == "2"] <- "Daphne_gnidium"
plants2016$j[plants2016$j == "3"] <- "Ficus_carica"
plants2016$j[plants2016$j == "4"] <- "Lonicera_periclymenum"
plants2016$j[plants2016$j == "5"] <- "Phillyrea_latifolia"
plants2016$j[plants2016$j == "6"] <- "Phytolacca_americana"
plants2016$j[plants2016$j == "7"] <- "Rhamnus_alaternus"
plants2016$j[plants2016$j == "8"] <- "Rubus_ulmifolius"
plants2016$j[plants2016$j == "9"] <- "Smilax_aspera"
plants2016$j[plants2016$j == "10"] <- "Vitis_vinifera"
write.table(plants2016, file = "C:/Multilayer seed dispersal network/Data/one.mode.plants.2016.txt", sep= " ", col.names = NA)

# Birds 2016
birds.2016<-t(VS16web)
one.mode16<-web2edges(birds.2016,return=TRUE)
birds2016<-projecting_tm(one.mode16, method="Newman")
targeti <- which(names(birds2016) == 'i')[1]
birds2016.1<-cbind(birds2016[,1:targeti,drop=F], data.frame(year=rep(2016,50)), birds2016[,(targeti+1):length(birds2016),drop=F])
targetj <- which(names(birds2016.1) == 'j')[1]
birds2016<-cbind(birds2016.1[,1:targetj,drop=F], data.frame(year=rep(2016,50)), birds2016.1[,(targetj+1):length(birds2016.1),drop=F])
birds2016$i<-as.character(birds2016$i)
birds2016$i[birds2016$i == "1"] <- "Cyanistes_caeruleus"
birds2016$i[birds2016$i == "2"] <- "Erithacus_rubecula"
birds2016$i[birds2016$i == "3"] <- "Ficedula_hypoleuca"
birds2016$i[birds2016$i == "4"] <- "Sylvia_atricapilla"
birds2016$i[birds2016$i == "5"] <- "Sylvia_borin"
birds2016$i[birds2016$i == "6"] <- "Sylvia_communis"
birds2016$i[birds2016$i == "7"] <- "Sylvia_melanocephala"
birds2016$i[birds2016$i == "8"] <- "Turdus_merula"

birds2016$j<-as.character(birds2016$j)
birds2016$j[birds2016$j == "1"] <- "Cyanistes_caeruleus"
birds2016$j[birds2016$j == "2"] <- "Erithacus_rubecula"
birds2016$j[birds2016$j == "3"] <- "Ficedula_hypoleuca"
birds2016$j[birds2016$j == "4"] <- "Sylvia_atricapilla"
birds2016$j[birds2016$j == "5"] <- "Sylvia_borin"
birds2016$j[birds2016$j == "6"] <- "Sylvia_communis"
birds2016$j[birds2016$j == "7"] <- "Sylvia_melanocephala"
birds2016$j[birds2016$j == "8"] <- "Turdus_merula"
write.table(birds2016, file = "C:/Multilayer seed dispersal network/Data/one.mode.birds.2016.txt", sep= " ", col.names = NA)

# One file for bird species
birds<-rbind(birds2012,birds2013,birds2014,birds2015,birds2016)
names(birds) <- NULL
write.table(birds, file = "C:/Multilayer seed dispersal network/Data/one.mode.birds.txt", quote = FALSE, sep= " ", col.names = NA)

# One file for plant species
plants<-rbind(plants2012,plants2013,plants2014,plants2015,plants2016)
names(plants) <- NULL
write.table(plants, file = "C:/Multilayer seed dispersal network/Data/one.mode.plants.txt", quote = FALSE, sep= " ", col.names = NA)



# Calculate species-level descriptors (degree, strength, and d') ####
birds2012<-cbind(specieslevel(VS12web)$`higher level`[1],specieslevel(VS12web)$`higher level`[3],specieslevel(VS12web)$`higher level`[20])
birds2012$year<-rep(2012,nrow(birds2012))
seeds2012<-cbind(specieslevel(VS12web)$`lower level`[1],specieslevel(VS12web)$`lower level`[3],specieslevel(VS12web)$`lower level`[20])
seeds2012$year<-rep(2012,nrow(seeds2012))
birds2013<-cbind(specieslevel(VS13web)$`higher level`[1],specieslevel(VS13web)$`higher level`[3],specieslevel(VS13web)$`higher level`[20])
birds2013$year<-rep(2013,nrow(birds2013))
seeds2013<-cbind(specieslevel(VS13web)$`lower level`[1],specieslevel(VS13web)$`lower level`[3],specieslevel(VS13web)$`lower level`[20])
seeds2013$year<-rep(2013,nrow(seeds2013))
birds2014<-cbind(specieslevel(VS14web)$`higher level`[1],specieslevel(VS14web)$`higher level`[3],specieslevel(VS14web)$`higher level`[20])
birds2014$year<-rep(2014,nrow(birds2014))
seeds2014<-cbind(specieslevel(VS14web)$`lower level`[1],specieslevel(VS14web)$`lower level`[3],specieslevel(VS14web)$`lower level`[20])
seeds2014$year<-rep(2014,nrow(seeds2014))
birds2015<-cbind(specieslevel(VS15web)$`higher level`[1],specieslevel(VS15web)$`higher level`[3],specieslevel(VS15web)$`higher level`[20])
birds2015$year<-rep(2015,nrow(birds2015))
seeds2015<-cbind(specieslevel(VS15web)$`lower level`[1],specieslevel(VS15web)$`lower level`[3],specieslevel(VS15web)$`lower level`[20])
seeds2015$year<-rep(2015,nrow(seeds2015))
birds2016<-cbind(specieslevel(VS16web)$`higher level`[1],specieslevel(VS16web)$`higher level`[3],specieslevel(VS16web)$`higher level`[20])
birds2016$year<-rep(2016,nrow(birds2016))
seeds2016<-cbind(specieslevel(VS16web)$`lower level`[1],specieslevel(VS16web)$`lower level`[3],specieslevel(VS16web)$`lower level`[20])
seeds2016$year<-rep(2016,nrow(seeds2016))
net.birds<-rbind(birds2012,birds2013,birds2014,birds2015,birds2016)
write.table(net.birds, file = "C:/Multilayer seed dispersal network/Data/Bird species-level descriptors.csv", sep= ";", col.names = NA)
net.seeds<-rbind(seeds2012,seeds2013,seeds2014,seeds2015,seeds2016)
write.table(net.seeds, file = "C:/Multilayer seed dispersal network/Data/Seed species-level descriptors.csv", sep= ";", col.names = NA)


# Data analysis (GLMs, LMMs, and GLMMs)####
#*******************************BIRDS*******************************
versatility.birds<-read.xlsx("Dataset.xlsx",sheet=9,colNames=T)
birds<-read.xlsx("Dataset.xlsx",sheet=8,colNames=T)
birds$d<-as.numeric(birds$d)
birds$strength<-as.numeric(birds$strength)
birds$degree<-as.integer(birds$degree)
birds$N.Years<-as.integer(birds$N.Years)
birds$seed.spp<-as.integer(birds$seed.spp)
birds$Year<-factor(birds$Year)
birds$Group<-factor(birds$Group)
birds2<-na.exclude(birds)

# versatility~N.years********************
M0<-glm(versatility~N.Years,data=versatility.birds,family=Gamma(link="log"))
M0null<-glm(versatility~1,data=versatility.birds,family=Gamma(link="log"))
anova(M0null,M0,test="LRT")

plot(M0$fitted.values,M0$residuals)
plot(M0)
confint(M0,level=0.95)


# d~N.years********************
library(lme4)
library(afex)
M1<-lmer(d~N.Years+(1|Year),data=birds2)
confint.merMod(M1,level=0.95,nsim=1000,method="boot")

Model1<-mixed(d~N.Years+(1|Year),data=birds2,method="PB",
              args_test=list(nsim = 1000)) # This function uses the package lme4 to fit the model
summary(Model1)

hist(residuals(M1))
plot(M1,type=c("p","smooth"))
ff <- fortify(M1)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# d~bird.group********************
M2<-lmer(d~Group+(1|Year),data=birds2)
confint.merMod(M2,level=0.95,nsim=1000,method="boot")
Model2<-mixed(d~Group+(1|Year),data=birds2,method="PB",
              args_test=list(nsim = 1000))

plot(M2,type=c("p","smooth"))
hist(residuals(M2))
ff <- fortify(M2)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# strength~N.years********************
M3<-glmer(strength~N.Years+(1|Year),data=birds2,family=Gamma(log))
confint.merMod(M3,level=0.95,method="boot")
Model3<-mixed(strength~N.Years+(1|Year),data=birds2,family=Gamma(log),method="PB",
              args_test=list(nsim = 1000))
summary(Model3)

plot(M3,type=c("p","smooth"))
ff <- fortify(M3)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# strength~bird.group********************
M4<-glmer(strength~Group+(1|Year),data=birds2,family=Gamma(log))
confint.merMod(M4,level=0.95,nsim=1000,method="boot")
Model4<-mixed(strength~Group+(1|Year),data=birds2,family=Gamma(log),method="PB",
              args_test=list(nsim = 1000))
summary(Model4)

plot(M4,type=c("p","smooth"))
ff <- fortify(M4)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# degree~N.years********************
M5<-glmer(degree~N.Years+(1|Year),data=birds2,family=poisson,offset=log(seed.spp))
library("blmeco")
dispersion_glmer(M5) #Assessing dispersion parameter
confint.merMod(M5,level=0.95,nsim=1000,method="boot")
Model5<-mixed(degree~N.Years+(1|Year)+offset(log(seed.spp)),data=birds2,
              family=poisson,method="PB",
              args_test=list(nsim = 1000))

plot(M5,type=c("p","smooth"))
ff <- fortify(M5)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# degree~bird.group********************
M6<-glmer(degree~Group+(1|Year),data=birds2,family=poisson,offset=log(seed.spp))
M6null<-glmer(degree~1+(1|Year),data=birds2,family=poisson,offset=log(seed.spp))
dispersion_glmer(M6)
confint.merMod(M6,level=0.95,nsim=1000,method="boot")
Model6<-mixed(degree~Group+(1|Year)+offset(log(seed.spp)),data=birds2,
              family=poisson,method="PB",
              args_test=list(nsim = 1000))

plot(M6,type=c("p","smooth"))
ff <- fortify(M6)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

#*******************************PLANTS*********************
versatility.seeds<-read.xlsx("Dataset.xlsx",sheet=11,colNames=T)
seeds<-read.xlsx("Dataset.xlsx",sheet=10,colNames=T)
seeds$d<-as.numeric(seeds$d)
seeds$strength<-as.numeric(seeds$strength)
seeds$degree<-as.integer(seeds$degree)
seeds$N.Years<-as.integer(seeds$N.Years)
seeds$seed.spp<-as.integer(seeds$bird.spp)
seeds$Year<-factor(birds$Year)
seeds2<-na.exclude(seeds)

# versatility~N.years********************
M0<-glm(versatility~N.Years,data=versatility.seeds,family=Gamma(link="log"))
M0null<-glm(versatility~1,data=versatility.seeds,family=Gamma(link="log"))
plot(M0)
anova(M0null,M0,test="LRT")
confint(M0,level=0.95)

# d~N.years********************
M7<-lmer(d~N.Years+(1|Year),data=seeds2)
confint.merMod(M7,level=0.95,nsim=1000,method="boot")
Model7<-mixed(d~N.Years+(1|Year),data=seeds2,method="PB",
              args_test=list(nsim = 1000))

hist(residuals(M7))
plot(M7,type=c("p","smooth"))
ff <- fortify(M7)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# strength~N.years********************
M8<-glmer(strength~N.Years+(1|Year),data=seeds2,family=Gamma(log))
confint.merMod(M8,level=0.95,nsim=1000,method="boot")
Model8<-mixed(strength~N.Years+(1|Year),data=seeds2,family=Gamma(log),method="PB",
              args_test=list(nsim = 1000))

plot(M8,type=c("p","smooth"))
ff <- fortify(M8)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()

# degree~N.years********************
M9<-glmer(degree~N.Years+(1|Year),data=seeds2,family=poisson,offset=log(bird.spp))
dispersion_glmer(M9)
confint.merMod(M9,level=0.95,nsim=1000,method="boot")
Model9<-mixed(degree~N.Years+(1|Year)+offset(log(bird.spp)),data=seeds2,
              family=poisson,method="PB",
              args_test=list(nsim = 1000))

plot(M9,type=c("p","smooth"))
ff <- fortify(M9)
ff <- transform(ff,Year=reorder(Year,X=.resid,FUN=mean,sort=sort))
ggplot(ff,aes(x=Year,y=.resid))+geom_boxplot()+
  geom_point(size=4,alpha=0.5)+
  coord_flip()
# Figure 2 ####
# Bird species ordered by the mean number of birds captured per year (as a proxy for species abundances)
# Plant species ordered by the mean abundance of fruits counted in the transects each year
sequence.birds<-c("Erithacus rubecula","Ficedula hypoleuca","Sylvia atricapilla",
                  "Sylvia melanocephala","Sylvia borin","Turdus merula",
                  "Chloris chloris","Cyanistes caeruleus","Muscicapa striata",
                  "Sylvia communis","Dendrocopos major","Sylvia undata")
sequence.plants<-c("Smilax aspera","Viburnum tinus","Pistacia lentiscus",
                   "Arbutus unedo","Crataegus monogyna","Rhamnus alaternus",
                   "Rubia peregrina","Olea europaea","Rosa sempervirens",
                   "Phillyrea latifolia","Ruscus aculeatus","Daphne gnidium",
                   "Ficus carica","Lonicera periclymenum","Phillyrea angustifolia",
                   "Phytolacca americana","Rubus ulmifolius","Solanum nigrum",
                   "Vitis vinifera")
birds.fig2<-read.xlsx("Dataset.xlsx",sheet=12,colNames=T)
seeds.fig2<-read.xlsx("Dataset.xlsx",sheet=13,colNames=T)
library(ggplot2)

# Bird species specialization d'
ggplot(data=birds.fig2,aes(x=Species,y=mean.d,fill=n.years,width=0.7))+
  geom_bar(stat="identity",color="black", size=0.1,position = "dodge")+
  geom_errorbar(aes(ymax = mean.d+SE.d,
                    ymin = mean.d-SE.d), position = position_dodge(width = .1), width = 0.3)+
  scale_x_discrete(limits = sequence.birds)+
  scale_fill_manual(values = c("red","#660000","blue","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Specialization d'")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,0.60),breaks=c(0.00,0.15,0.30,0.45,0.60))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Bird species strength
ggplot(data=birds.fig2,aes(x=Species,y=mean.strength,fill=n.years,width=0.7))+
  geom_bar(stat="identity",color="black", size=0.1,position = "dodge")+
  geom_errorbar(aes(ymax = mean.strength+SE.strength,
                    ymin = mean.strength-SE.strength), position = position_dodge(width = .1), width = 0.3)+
  scale_x_discrete(limits = sequence.birds)+
  scale_fill_manual(values = c("red","#660000","blue","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Strength")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,5.5),breaks=c(0.0,1,2,3,4,5))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Bird species degree
ggplot(data=birds.fig2,aes(x=Species,y=mean.degree,fill=n.years,width=0.7))+
  geom_bar(stat="identity",colour = "black",size=0.1,position = "dodge")+
  geom_errorbar(aes(ymax = mean.degree+SE.degree,
                    ymin = mean.degree-SE.degree), position = position_dodge(width = .8), width = 0.3)+
  scale_x_discrete(limits = sequence.birds)+
  scale_fill_manual(values = c("red","#660000","blue","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Degree")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,10),breaks=c(0,2,4,6,8,10))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Bird species versatility
ggplot(data=birds.fig2,aes(x=Species,y=versatility,fill=n.years,width=0.7))+
  geom_bar(stat="identity",colour = "black",size=0.1,position = "dodge")+
  scale_x_discrete(limits = sequence.birds)+
  scale_fill_manual(values = c("red","#660000","blue","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Versatility")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,1),breaks=c(0.00,0.25,0.50,0.75,1.00))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Plant species specialization d'
ggplot(data=seeds.fig2,aes(x=Species,y=mean.d,fill=n.years,width=0.7))+
  geom_bar(stat="identity",colour = "black",size=0.1,position = "dodge")+
  geom_errorbar(aes(ymax = mean.d+SE.d,
                    ymin = mean.d-SE.d), position = position_dodge(width = .8), width = 0.3)+
  scale_x_discrete(limits = sequence.plants)+
  scale_fill_manual(values = c("red","#660000","blue","#CC00CC","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Specialization d'")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,0.45),breaks=c(0.00,0.15,0.30,0.45))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Plant species strength
ggplot(data=seeds.fig2,aes(x=Species,y=mean.strength,fill=n.years,width=0.7))+
  geom_bar(stat="identity",colour = "black",size=0.1,position = "dodge")+
  geom_errorbar(aes(ymax = mean.strength+SE.strength,
                    ymin = mean.strength-SE.strength), position = position_dodge(width = .8), width = 0.3)+
  scale_x_discrete(limits = sequence.plants)+
  scale_fill_manual(values = c("red","#660000","blue","#CC00CC","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Strength")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,3.5),breaks=c(0,1.2,2.3,3.5))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Plant species degree
ggplot(data=seeds.fig2,aes(x=Species,y=mean.degree,fill=n.years,width=0.7))+
  geom_bar(stat="identity",colour = "black",size=0.1,position = "dodge")+
  geom_errorbar(aes(ymax = mean.degree+SE.degree,
                    ymin = mean.degree-SE.degree), position = position_dodge(width = .8), width = 0.3)+
  scale_x_discrete(limits = sequence.plants)+
  scale_fill_manual(values = c("red","#660000","blue","#CC00CC","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Degree")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,8),breaks=c(0,2,4,6,8))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position="none",
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())

# Plant species versatility
ggplot(data=seeds.fig2,aes(x=Species,y=versatility,fill=n.years,width=0.7))+
  geom_bar(stat="identity",colour = "black",size=0.1,position = "dodge")+
  scale_x_discrete(limits = sequence.plants)+
  scale_fill_manual(values = c("red","#660000","blue","#CC00CC","#660066"))+
  theme_bw()+
  theme(axis.text.x = element_text(angle = 45, hjust = 1, size=18,color="black"))+
  theme(axis.text.y = element_text(angle = 0, hjust = 1, size=10,color="black"))+
  ylab("Versatility")+
  xlab(" ")+
  scale_y_continuous(limits=c(0,1),breaks=c(0.00,0.25,0.50,0.75,1.00))+
  theme(axis.line.x = element_line(colour = "black"),
        axis.line.y = element_line(colour = "black"),
        axis.title=element_text(size=14),
        legend.position=c(0.75, 0.75),
        legend.title=element_blank(),
        panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        panel.background = element_blank())


#******************************************************************************
# Figure S1 ####
year2013<-read.xlsx("Dataset.xlsx",sheet=6,colNames=T)

ggplot(data = year2013, aes(x=N.Day,y=Diversity.of.links)) +
  scale_x_continuous(limits=c(-3,360), breaks=c(12,42,70,101,131,
                                                162,192,223,254,284,315,345),
                     labels=c("J","F","M","A","M","J","J","A","S","O","N","D"))+
  scale_y_continuous(#expand = c(0, 0),
    limits=c(0,18), 
    breaks=c(0,3,6,9,12,15,18))+
  geom_line(aes(x=N.Day,y=Diversity.of.links))+
  xlab("")+
  ylab("Number of seed-bird links")+
  theme(legend.position="none")+
  theme(panel.background = element_blank())+
  theme(panel.border = element_rect(colour = "black", fill=NA))
#*************************************************************************************

# Figure S2 ####
# Differences in species degree among bird migratory status group
ggplot(data=birds2, aes(x=Group,y=degree))+
  geom_boxplot()+
  geom_point(aes(colour = Year),size=1.8,position = position_dodge(0.1))+
  theme_bw()+
  scale_y_continuous(limits=c(0,15),breaks=c(0,5,10,15))+
  scale_x_discrete(breaks=c("1_resident","2_partialmigratory","3_migratory"),
                   labels=c("Resident", expression(atop("Partially",paste("migratory"))),
                            "Migratory"))+
  xlab("")+
  ylab("Degree")+
  theme(panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        axis.title.y = element_text(size=14),
        axis.text.x=element_text(size=14,colour="black"),
        axis.text.y=element_text(size=12,colour="black"))

# Differences in species strength among bird migratory status group
ggplot(data=birds2, aes(x=Group,y=strength))+
  geom_boxplot()+
  geom_point(aes(colour = Year),size=1.8,position = position_dodge(0.1))+
  theme_bw()+
  scale_x_discrete(breaks=c("1_resident","2_partialmigratory","3_migratory"),
                   labels=c("Resident", expression(atop("Partially",paste("migratory"))),
                            "Migratory"))+
  xlab("")+
  ylab("Strength")+
  theme(panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        axis.title.y = element_text(size=14),
        axis.text.x=element_text(size=14,colour="black"),
        axis.text.y=element_text(size=12,colour="black"))

# Differences in species specialization d' among bird migratory status group
ggplot(data=birds2, aes(x=Group,y=d))+
  geom_boxplot()+
  geom_point(aes(colour = Year),size=1.8,position = position_dodge(0.1))+
  theme_bw()+
  scale_x_discrete(breaks=c("1_resident","2_partialmigratory","3_migratory"),
                   labels=c("Resident", expression(atop("Partially",paste("migratory"))),
                            "Migratory"))+
  xlab("")+
  ylab("Specialization d'")+
  theme(panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        axis.title.y = element_text(size=14),
        axis.text.x=element_text(size=14,colour="black"),
        axis.text.y=element_text(size=12,colour="black"))

#*************************************************************************************
# Figure S3 ####
Fig_S3<-read.xlsx("Dataset.xlsx",sheet=14,colNames=T)
Fig_S3$Year<-factor(Fig_S3$Year)
ggplot(data=Fig_S3, aes(Year))+
  geom_boxplot(aes(ymin = Connectance_null2.5percentile,
                   lower = Connectance_nullmean-Connectance_nullSD,
                   middle = Connectance_nullmean,
                   upper = Connectance_nullmean+Connectance_nullSD,
                   ymax = Connectance_null97.5percentile),stat = "identity")+
  geom_point(aes(y=Connectance_obs),colour="red",size=1)+
  scale_y_continuous(limits=c(0,0.6),breaks=c(0,0.1,0.2,0.3,0.4,0.5,0.6))+
  theme_bw()+
  xlab("")+
  ylab("Connectance")+
  theme(panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        axis.title.y = element_text(size=14),
        axis.text.x=element_text(size=14,colour="black"),
        axis.text.y=element_text(size=12,colour="black"))

ggplot(data=Fig_S3, aes(Year))+
  geom_boxplot(aes(ymin = Nestedness_null2.5percentile,
                   lower = Nestedness_nullmean-Nestedness_nullSD,
                   middle = Nestedness_nullmean,
                   upper = Nestedness_nullmean+Nestedness_nullSD,
                   ymax = Nestedness_null97.5percentile),stat = "identity")+
  geom_point(aes(y=Nestedness_obs),colour="red",size=1)+
  scale_y_continuous(limits=c(0,0.6),breaks=c(0,0.1,0.2,0.3,0.4,0.5,0.6))+
  theme_bw()+
  xlab("")+
  ylab("Weighted Nestedness")+
  theme(panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        axis.title.y = element_text(size=14),
        axis.text.x=element_text(size=14,colour="black"),
        axis.text.y=element_text(size=12,colour="black"))

ggplot(data=Fig_S3, aes(Year))+
  geom_boxplot(aes(ymin = H2_null2.5percentile,
                   lower = H2_nullmean-H2_nullSD,
                   middle = H2_nullmean,
                   upper = H2_nullmean+H2_nullSD,
                   ymax = H2_null97.5percentile),stat = "identity")+
  geom_point(aes(y=H2_obs),colour="red",size=1)+
  scale_y_continuous(limits=c(0,0.6),breaks=c(0,0.1,0.2,0.3,0.4,0.5,0.6))+
  theme_bw()+
  xlab("")+
  ylab("Network specialization H2'")+
  theme(panel.grid.major = element_blank(),
        panel.grid.minor = element_blank(),
        axis.title.y = element_text(size=14),
        axis.text.x=element_text(size=14,colour="black"),
        axis.text.y=element_text(size=12,colour="black"))

  

# Multilayer Modularity ####

# We were unable to upload the Matlab file with the generalized Louvain algorithm
# The version that we used can be 
# downloaded from https://figshare.com/articles/Matlab_code_for_examination_of_modularity/3472679/3
# where it can be found in the file "GenLouvain 2.0.zip"

# Load libraries and functions
library(bipartite)
library(igraph)
library(ggplot2)
library(reshape2)
library(stringr)
library(plyr)
library(RColorBrewer)


# Remove all objects, including functions
rm(list=ls())
# Remove all objects, except functions
rm(list = setdiff(ls(), lsf.str()))

df2matrix <- function(df,binary=F){
  rownames(df) <- df[,1]
  df <- df[,-1]
  df <- data.matrix(df)
  if (binary){df[df>0] <- 1}
  return(df)
}

ggplotToBrowser <- function(p, w=35, h=16.875) {
  ggsave(filename = tf_img <- tempfile(fileext = ".svg"), plot = p, width=w, height=h, units = 'cm')
  html <- sprintf('<html><body><img src="%s"></body></html>', paste0("file:///", tf_img))
  cat(html, file = tf_html <- tempfile(fileext = ".html"))
  if(Sys.info()[1]=="Linux"){
    options(browser="google-chrome")
    browseURL(tf_html)  
  } else {
    system(sprintf("open %s", tf_html))  
  }
}
#################################################################################################
# 1. prepare the data (Multilayer Modularity)
#################################################################################################
# The data to calculate multilayer modularity is in the file "multilayer_temporal_data.csv"

dat <- read.csv('multilayer_temporal_data.csv',sep=";")

attach(dat)
DisperserAbundYear <- as.matrix(table(Disperser, Year)) # abundance of disperser spp in different years
seedAbundanceYear <- aggregate(.~dat$Year,data = dat[,3:ncol(dat)], FUN = sum) # abundance of parasites in each year (across hosts)
names(seedAbundanceYear)[1] <- 'Year'
seedAbundanceYear <- df2matrix(seedAbundanceYear)


#### Create and write network layers
data.list <- list()
years <- 2012:2016
for (y in years){
  idx <- which(years==y)
  d <- dat[dat$Year==y,]
  d <- aggregate(.~d$Disperser, data=d[,2:ncol(d)], sum) # The total number of parasites found on a given host
  d <- d[-2]
  d <- df2matrix(d)
  d <- sweep(d, 1, DisperserAbundYear[rownames(DisperserAbundYear)%in%rownames(d), idx], '/') # Average parasite abundance per host
  missingDisperser <- setdiff(rownames(DisperserAbundYear),rownames(d)) # All hosts have to appear in all matrices even if they were not present
  d <- rbind(d,matrix(0,length(missingDisperser),ncol(d),dimnames =  list(missingDisperser,colnames(d)))) # Add missing host species so all matrices will have the same size
  d <- d[sort(rownames(d)),] # sort by host so all matrices will have the same order
  data.list[[idx]] <- d
  write.table(d, paste('host_parasite_abundance_weighted_layer_',idx,'.csv',sep=''), row.names = F, col.names = F,sep=',')
}
names(data.list) <- years
sapply(data.list,dim)


### Use changes in species relative abundance as interlayer link weights
# The abundance of disperser spp. is the mean number of birds captured per day for each year
# The abundance of "seed" spp. is the mean number of fruits counted in transects in each year
# Dispersed seed spp. from species not found in the transects the abundance = 1
mat <- as.matrix (read.table("DisperserAbundanceMatrix.txt", header =T, row.names= 1, sep="\t", dec="."))
tot <- ncol(mat)
interlayerEdgesHost <- matrix(0,nrow(mat),tot-1,dimnames=list(rownames(mat),colnames(mat)[-1]))
for (x in 1:(tot-1)){
  interlayerEdgesHost[,x] <- mat[,x+1]/mat[,x]
}
mat <- as.matrix (read.table("SeedsAbundanceMatrix.txt", header =T, row.names= 1, sep="\t", dec="."))
tot <- ncol(mat)
interlayerEdgesParas <- matrix(0,nrow(mat),tot-1,dimnames=list(rownames(mat),colnames(mat)[-1]))
for (x in 1:(tot-1)){
  interlayerEdgesParas[,x] <- mat[,x+1]/mat[,x]
}
interlayerEdges <- rbind(interlayerEdgesHost,interlayerEdgesParas)
interlayerEdges[is.nan(interlayerEdges)] <- 0
interlayerEdges[is.infinite(interlayerEdges)] <- 0

ile <- c()
for (i in 1:4){
  ile <- c(ile, interlayerEdges[,i])
}

N=nrow(data.list[[1]])+ncol(data.list[[1]])
L=length(data.list)
mat=matrix(0,N*L,N*L)
delta <- row(mat) - col(mat)
mat[delta == N] <- ile
mat[delta == -N] <- ile
isSymmetric(mat)
# This file will be used in the analysis of modular structure (done in Matlab).
# It is actually a supra-adjacency matrix where all cells have a value of zero
# besides the off-block diagonals, which contain the interlayer edges.
write.table(mat,'interlayer_relative_abundance_matrix.csv', row.names = F, col.names = F,sep=',')


### Reshuffle interactions within each layer -- this is for the null model in the analysis of modularity

# The idea here is to reshuffle the networks when
# they contain only the species that appeared in a given year and then paste
# them back to a matrix with all the species/interactions
dir.create('reshuffled_networks_abundance')
realizations=1000
baseMatrix <- data.list[[1]]
baseMatrix[baseMatrix>0]=0
for (l in 1:5){
  y <- years[l]
  d <- dat[dat$Year==y,]
  d <- aggregate(.~d$Disperser, data=d[,2:ncol(d)], sum)
  d <- d[-2]
  d <- df2matrix(d)
  nullnets <- vegan::nullmodel(bipartite::empty(d), method = 'r2dtable') # Patefield's algorithm  
  nullnets <- simulate(nullnets, nsim = realizations)
  dim(nullnets)
  for (i in 1:realizations){
    print(i)
    x=baseMatrix
    x[rownames(nullnets[,,i]),colnames(nullnets[,,i])] <- sweep(nullnets[,,i], 1, DisperserAbundYear[rownames(DisperserAbundYear)%in%rownames(nullnets[,,i]), l], '/')
    write.table(x, paste('reshuffled_networks_abundance/network_',i,'_layer_',l,'.csv',sep=''), row.names = F,col.names =F,sep=',')
  }
}

#################################################################################################
# 2. Analyze modular structure. This is done in Matlab
#################################################################################################

#################################################################################################
# 3. Post analysis of the modular structure
#################################################################################################

## Give each species an index
dispersers <- unique(as.vector(sapply(data.list, rownames)))
seeds <- unique(as.vector(sapply(data.list, colnames)))
species <- c(dispersers,seeds)
any(duplicated(species))
nodes.df <- data.frame(nodeID=1:length(species),nodeLabel=species)


output_folder='output'
# Analyze the values of the modularity function
Q.multilayerlObs <- unname(data.matrix(read.table(paste(output_folder,'/Q_obs.csv',sep=''),he=F,sep=',')))
Q.multilayerlNull1 <- unname(data.matrix(read.table(paste(output_folder,'/Q_null1.csv',sep=''),he=F,sep=',')))

mean(Q.multilayerlObs)
quantile(Q.multilayerlObs,c(0.025,0.975))
mean(Q.multilayerlNull1)
quantile(Q.multilayerlNull1,c(0.025,0.975))

# Function to calculate the average number of modules and also the average propotion of species that switch modules.
# Input is the file that contains the module affiliations (memberships) that was produced in Matlab.
analyzeModuleAffiliation <- function(membership){
  runs=ncol(membership)
  membershipRuns <- matrix(0,length(species),runs,dimnames = list(species,1:runs)) # to store the module affiliation of species across runs
  modulesRuns <- rep(0,runs) #to store the number of modules across runs
  speciesFlexibility <- matrix(0,2,runs,dimnames = list(c('dispersers','seeds'),1:runs))
  for (r in 1:runs){
    membershipRun <- matrix(membership[,r], nrow=29,ncol=5) # This reshapes the vector to a matrix of dimensions nodes X layers
    colnames(membershipRun) <- c('2012','2013','2014','2015','2016')
    membershipRun <- as.data.frame(membershipRun)
    membershipRun <- cbind(species,c(rep('dispersers',length(dispersers)),rep('paras',length(seeds))),membershipRun)
    names(membershipRun)[2] <- 'type'
    speciesPresence <- rbind(DisperserAbundYear,t(seedAbundanceYear))
    speciesPresence[speciesPresence>0] <- 1
    if(!all(rownames(speciesPresence)==membershipRun$species)){stop('error')}
    membershipRun[,3:7] <- membershipRun[,3:7]*speciesPresence # make zero whenever a species is not in a layer
    # To how many communitites were species classified across years?
    membershipRuns[,r] <- apply(membershipRun[,3:7], 1, function(x) length(unique(x[x!=0])))
    # Number of bird species that were assigned to more than 1 module
    speciesFlexibility['dispersers',r] <- sum(membershipRuns[1:length(dispersers),r]>1)
    # Number of seed species that were assigned to more than 1 module
    speciesFlexibility['seeds',r] <- sum(membershipRuns[(length(dispersers)+1):length(species),r]>1)
    # Number of modules
    modulesRuns[r] <- length(unique(unlist(membershipRun[,3:7])))-1 #reduce one to ommit the zero values which indicate species absence and not a module
  }
  return(list(modulesRuns=modulesRuns,speciesFlexibility=speciesFlexibility))
}

moduleAnalysisObs <- analyzeModuleAffiliation(read.csv('output/S_obs.csv', he=F))
moduleAnalysisNull1 <- analyzeModuleAffiliation(read.csv('output/S_null1.csv', he=F))

# Average number of modules
mean(moduleAnalysisObs$modulesRuns)
mean(moduleAnalysisNull1$modulesRuns)

#### Plot the modularity membership
# To plot this first one should find out which is the run with the maximum Q_B
maxrun <- which(Q.multilayerlObs==max(Q.multilayerlObs))
# This is now the same code as in the for loop of the analyzeModuleAffiliation function
membership <- read.csv('output/S_obs.csv', he=F)
membershipRun <- matrix(membership[,maxrun], nrow=29,ncol=5) # This reshapes the vector to a matrix of dimensions nodes X layers
colnames(membershipRun) <- c('2012','2013','2014','2015','2016')
membershipRun <- as.data.frame(membershipRun)
membershipRun <- cbind(species,c(rep('dispersers',length(dispersers)),rep('paras',length(seeds))),membershipRun)
names(membershipRun)[2] <- 'type'
speciesPresence <- rbind(DisperserAbundYear,t(seedAbundanceYear))
speciesPresence[speciesPresence>0] <- 1
if(!all(rownames(speciesPresence)==membershipRun$species)){stop('error')}
membershipRun[,3:7] <- membershipRun[,3:7]*speciesPresence # make zero whenever a species is not in a layer

# Plot module affiliation across years
membership_plot <- melt(membershipRun, id.vars = c('species','type'))
names(membership_plot) <- c('species','type','year','module')
membership_plot <- membership_plot[membership_plot$module!=0,]
unique(membership_plot$module)
moduleNumbers <- sort(unique(membership_plot$module)) # Make the module numbers consecutive
membership_plot$module <- match(membership_plot$module,moduleNumbers)
membership_plot$module <- factor(membership_plot$module)
membership_plot$species <- factor(membership_plot$species, levels=rev(levels(membership_plot$species)))

membership_plot$species <- str_replace(membership_plot$species,'_',' ')
p=ggplot(data = membership_plot, aes(x=year,y=species, color=module))+geom_point(size=3, shape=15)+
  facet_grid(type~.,space='free', scales='free')+theme_bw()+  scale_color_brewer(palette="Set1")
ggplotToBrowser(p, 20,40)
