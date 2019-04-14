require('dotenv').config();
const express = require("express");
const path = require('path')
const bodyParser = require("body-parser");
const app = express();
// const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3.js');
var cors = require("cors");
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('7a7ea783738a496d99eec1bcdd6cff7b');
var NaturalLanguageUnderstandingV1 = require("ibm-watson/natural-language-understanding/v1.js");

var corsOptions = {
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
var listener = app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(
    "Jsuis le server et je viens de START AIE AIE AIE CA VA CHIER J AI AUCUNE DATA A TE MONTRER JE SUIS LA JUSTE POUR TE CASSER LES COUILLES",
  );
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(bodyParser.json());

var short_analyses = [];
var finalDetail = {
  score: 0,
  icon: "",
  mainCategories: [],
  mainKeywords: [],
  entities:{},
  listOfAllUrls: [],
  metadata: []
};
var articlesUrl = [];
var googleArticles = []
let entities = []
// ENDPOINT FOR POST


app.post("/:keyword",  function(request, response) {
  const userInput = request.params.keyword;
  console.log('the user input', userInput)
  var formatedInput = userInput.replace(/ /g,"-");
  googleArticles = []
  newsapi.v2.everything({
    // sources: 'bbc-news,the-verge',
    q: formatedInput,
      // category: 'business',
    language: 'en',
    sortBy: 'relevance'
    // country: userInput
  }).then( googleRes => {
    // console.log('google news api json : ', googleRes);
    const metaObject = [];
    googleArticles = Object.values(googleRes)[2]
    if(googleArticles.length > 20) {
      googleArticles.length = 20
    }
    let asyncCounter = googleArticles.length
    googleArticles.forEach( function(article, i) {
      if(article.url) {
        var nlu = new NaturalLanguageUnderstandingV1({
          version: "2018-11-16",
        });
        var options = {
          url: article.url,
          features: {
            // concepts: {},
            categories: {},
            entities: {},
            // keywords: {},
            sentiment: {}
          }
        };
        nlu.analyze(options,  function(err, res) {
            asyncCounter -= 1
          if (res) {
            asyncCounter += 1
            res['title'] = article.title
            metaObject.push(res);
          }
          else{
            console.log('error in ibm analysis for one article', err)
            return;
          }
          console.log(asyncCounter, 'vs', metaObject.length);
          if(metaObject.length === asyncCounter) {
            extractDataFromWatsonResponse(metaObject);
            console.log('end extractDataFromWatsonResponse')
            dataCalculation();
            console.log('end datacalcu')
            // finalDetail['abyCalcy']  = entities
            response.json(finalDetail);
          }
        
       
         
          // console.log(res);
        });
      }
      else{
        console.log('toxic article. if you see this it might have broken the moment we isolate the last element in the loop', article)
      }

  });
  })
  .catch(function(error) {
    console.log('error in google api fetch', error);
    response.send("could not fetch relevant article for this keyword", err);
  });7
})
// Extracting links from html templates

// Data logic
function extractDataFromWatsonResponse(metaObject) {
  short_analyses = [];
  finalDetail = {
    score: 0,
    icon: "",
    mainCategories: [],
    mainKeywords: [],
    entities:{},
    listOfAllUrls: [],
    metadata: []
  };
  entities = []
  // here we extract raw material from the object. And we start filtering some arrays if they are too long.
  metaObject.forEach(analyse => {
    short_analyses.push({
      generalInfo: analyse["sentiment"]["document"],
      title: analyse.title,
      categories: analyse["categories"][0],
      keywords: [
        analyse["entities"][0],
        analyse["entities"][1],
        analyse["entities"][2],
        analyse["entities"][3]
      ],
      url: analyse["retrieved_url"]
    });
  });
}

function sortEntities() {
  entities.forEach((entity)=>{
    if(Array.isArray(finalDetail.entities[entity['type']])) {
      if(finalDetail.entities[entity['type']].find(x => x.title === entity.title)) {
        finalDetail.entities[entity['type']].find(x => x.title === entity.title).count = finalDetail.entities[entity['type']].find(x => x.title === entity.title).count + 1
        finalDetail.entities[entity['type']].find(x => x.title === entity.title).title = entity.title
        finalDetail.entities[entity['type']].find(x => x.title === entity.title).article.push(entity.article)
      } else {
        finalDetail.entities[entity['type']].push({
          title: entity.title,
          article: [entity.article],
          count:1,
        })
      }
    }else {
      finalDetail.entities[entity['type']] = [{
        title: entity.title,
        article: [entity.article],
        count:1,
      }]
    }
  })
}

function dataCalculation() {
  console.log('go')
  let sumOfscore = 0;
  let scoreDivider = 0
  short_analyses.forEach((analyse) => {
    if(analyse["generalInfo"]['score'] !== 0) {
      scoreDivider += 1
    }
  })
  let commonCategories = [];
  short_analyses.forEach(analyse => {
    // logic for entities
    if(analyse['keywords'].length > 0) {
      analyse['keywords'].forEach((entity) =>{
        if(entity){
          entities.push({
            type: entity['type'],
            title: entity['text'],
            article: {url: analyse.url, score: analyse["generalInfo"]['score'], title: analyse.title} ,
          })
        }

      })
      // console.log(entities)
    }
    // score
      // logic for categories and score averages
    finalDetail.listOfAllUrls.push(analyse.url);
    sumOfscore = sumOfscore + analyse.generalInfo.score;
    let articlesSharingCategories = []
    if(analyse && analyse['categories']) {
      analyse.categories.articleScore = analyse.generalInfo.score;
      const currentCategories = analyse.categories.label;
      articlesSharingCategories = short_analyses.filter(
       x => x.categories && x.categories.label === currentCategories && x.url !== analyse.url
     );
    }
 
    if (articlesSharingCategories.length > 1) {
      commonCategories.push(articlesSharingCategories);
    }
  });
  sortEntities()
  var r = commonCategories.filter(((r = {}), a => !(2 - (r[a] = ++r[a] | 0))));
  // mainCategories calculation of the global score and retrieving global label. HEre we gonna get rid of keywords and url
  // HIGH CATEGORY SCORE MEANS HIGH RELIABILITY THAT THIS ARTICLE IS ABOUT THIS CATEGORY
  r.forEach(commonCategory => {
    //saving the label
    const categoryName = commonCategory[0]["categories"]["label"];
    let sumOfscore2 = 0;
    const scoreDivider2 = commonCategory.length;
    const urls = [];
    commonCategory.forEach(article => {
      if(article["categories"]["score"] !== 0) {
        sumOfscore2 = sumOfscore2 + article["categories"]["score"];
        urls.push({
          url: article["url"],
          score: article["categories"]["articleScore"],
          title:article.title
        });
      }
    });
    const categoryReliability = sumOfscore2 / scoreDivider2;
    if (urls.length > 5) {
      urls.length = 5;
    }
    finalDetail.mainCategories.push({
      label: categoryName,
      score: categoryReliability,
      listOfUrls: urls
    });
  });
  finalDetail.score = sumOfscore / scoreDivider;
  // this.changeGlobalScoreColor(this.finalDetail.score)
  finalDetail.mainCategories.forEach(cat => {
    let categoryScore = 0;
    const scoreDivider3 = cat.listOfUrls.length;

    cat.listOfUrls.forEach(article => {
      categoryScore = categoryScore + article.score;
    });
    const total = categoryScore / scoreDivider3;
    cat["globalCatScore"] = total;
  });
  finalDetail['articlesDetail'] = googleArticles
  // finalDetail.listOfAllUrls.length = 7;
  return finalDetail;
}


