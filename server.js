require('dotenv').config();


const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3.js');
const axios = require("axios");
var querystring = require("querystring");
var cors = require("cors");
var DomParser = require("dom-parser");
var JSON = require("json-circular-stringify");
var rssSource = "http://www.oecd.org/";
var rssSourceEnd = "/index.xml";
var rssGuardian = "https://www.theguardian.com/world/";
var fs = require("fs");
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('7a7ea783738a496d99eec1bcdd6cff7b');
var NaturalLanguageUnderstandingV1 = require("ibm-watson/natural-language-understanding/v1.js");
require("dotenv").config({ silent: true }); //  optional

var requiredUrl = "";
var corsOptions = {
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.listen(8000, () => {
  console.log(
    "Jsuis le server et je viens de START AIE AIE AIE CA VA CHIER J AI AUCUNE DATA A TE MONTRER JE SUIS LA JUSTE POUR TE CASSER LES COUILLES"
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
  listOfAllUrls: [],
  metadata: []
};
var articlesUrl = [];
var googleArticles = []
// ENDPOINT FOR POST
app.post("/sendNewsUrl/:keyword", function(request, response) {
  const userInput = request.params.keyword;
  console.log('the user input', userInput)
  googleArticles = []
  newsapi.v2.everything({
    // sources: 'bbc-news,the-verge',
    q: userInput,
      // category: 'business',
    language: 'en',
    sortBy: 'relevance'
    // country: userInput
  }).then(googleRes => {
    // console.log('googleres', googleRes)
    // console.log('google news api json : ', googleRes);
    const metaObject = [];
    googleArticles = Object.values(googleRes)[2]
    googleArticles.length = 20
    for (var i = 0; i <= googleArticles.length; i++) {
      if (googleArticles[i] ) {
        var nlu = new NaturalLanguageUnderstandingV1({
          version: "2018-11-16"
        });
        var options = {
          url: googleArticles[i].url,
          features: {
            // concepts: {},
            categories: {},
            entities: {},
            keywords: {},
            sentiment: {}
          }
        };
        nlu.analyze(options, function(err, res) {
          if (err) {
            console.log(err);
            return;
          }
          // console.log(res);
          metaObject.push(res);
          if (metaObject.length === googleArticles.length - 1) {
            setTimeout(() => {
              extractDataFromWatsonResponse(metaObject);
              dataCalculation();
              response.json(finalDetail);
              // console.log('end extractDataFromWatsonResponse', googleArticles)
            }, 1000);
          }
        });
        // translate the article before to analyze

        // const languageTranslator = new LanguageTranslatorV3({
        //    iam_apikey: 'Ca0B4XsSHGB7-uvoYvxrzg6Fh4F5pSoOqWix_v2uegja',
        //    url: 'https://gateway-lon.watsonplatform.net/language-translator/api',
        //   version: "2018-11-16"
        // });
        // const tamerlapute = googleArticles[i].description || 'MERDE'
        // console.log(tamerlapute)
        // const params = {
        //   text: tamerlapute,
        //   source:'fr',
        //   target: 'en',
        // }

        // languageTranslator.translate(params)
        // .then(body => {
        //   // console.log('\n');
        //   console.log('incroyable ############### ', body['translations'])
        // })
        // .catch(err => {
        //   console.log(err);
        // })
      }
    }
  })
  .catch(function(error) {
    console.log(error);
    response.send("this link is broken, give me another link");
  });
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
    listOfAllUrls: [],
    metadata: []
  };
  finalDetail.metadata = metaObject

  // here we extract raw material from the object. And we start filtering some arrays if they are too long.
  metaObject.forEach(analyse => {
    short_analyses.push({
      generalInfo: analyse["sentiment"]["document"],
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

function dataCalculation() {
  let sumOfscore = 0;
  let scoreDivider = 0
  short_analyses.forEach((analyse) => {
    if(analyse["generalInfo"]['score'] !== 0) {
      scoreDivider += 1
    }
  })
  let commonCategories = [];
  short_analyses.forEach(article => {
    // score
    finalDetail.listOfAllUrls.push(article.url);
    sumOfscore = sumOfscore + article.generalInfo.score;
    let articlesSharingCategories = []
    if(article && article['categories']) {
      article.categories.articleScore = article.generalInfo.score;
      const currentCategories = article.categories.label;
      articlesSharingCategories = short_analyses.filter(
       x => x.categories && x.categories.label === currentCategories && x.url !== article.url
     );
    }
 
    if (articlesSharingCategories.length > 1) {
      commonCategories.push(articlesSharingCategories);
    }
  });
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
          score: article["categories"]["articleScore"]
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


function getCountryLanguage(){}