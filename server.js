var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var multer = require('multer');
var http = require('http');
var request = require('request');
var mongoose = require('mongoose');
var session = require('express-session');
//var crypto = require('crypto');
var encryptor = require('file-encryptor');
var fs = require('fs');

var DoctorSchema;
var DoctorModel;
var PatientSchema;
var PatientModel;

function connectDB() {
    var databaseUrl = "mongodb://localhost:27017/DB";

    mongoose.connect(databaseUrl);
    database = mongoose.connection;

    database.on('error', console.error.bind(console, 'mongoose connection error.'));
    database.on('open', () => {
        DoctorSchema = mongoose.Schema({
            id: String,
            password: String,
            name: String,
            phone: String
        });

        PatientSchema = mongoose.Schema({
            id: String,
            name: String,
            sex: String,
            birth: String,
            phone: String
        });

        DoctorModel = mongoose.model("doctors", DoctorSchema);
        PatientModel = mongoose.model("patients", PatientSchema);
        console.log('mongoose connection opened! : ' + databaseUrl);
    });
    database.on('disconnected', connectDB);
}

/** 키로 파일명 암호화 하기**/
var _storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'medical_images/');
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});

var upload = multer({ storage: _storage});

app.use(session({
    secret: '45687145456hdf8h79gn13fgn5gf464',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));
app.locals.pretty = true;
app.set('view engine', 'jade');
app.set('views', './views');

var root = "http://localhost:4589";

app.get('/', (req, res) => {
    if(req.session.doctorId) return res.redirect('/login/success');
    res.render('index', {_root: root});
});

app.get('/join', (req, res) => {
    res.render('join', {_root: root});
});

app.post('/join/process', (req, res) => {
    request.post(
        { url: 'http://107.108.58.102:3000/api/CreateDoctor',
            form: { '$class': 'org.example.mynetwork.CreateDoctor',
                'doctorId': req.body.id,
                'doctorName': req.body.name,
                'phone': req.body.phone,
                'timestamp': Date()}}, (err, httpRes, body) => {
        switch(httpRes.statusCode) {
            case 200:
                var newDoctor = new DoctorModel({'id': req.body.id, 'password': req.body.password, 'name': req.body.name, 'phone': req.body.phone});
                newDoctor.save(err => {
                    if(err) callback(err, null);

                    req.session.doctorId = req.body.id;
                    req.session.doctorName = req.body.name;
                    req.session.doctorPhone = req.body.phone;
                    res.redirect('/login/success');
                });
                break;
            default:
                res.render('joinFailed', {_root: root});
                break;
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login', {_root: root});
});

app.all('/login/:state', (req, res) => {
    if(req.params.state == 'success') {
        res.render('loginSuccess', {_root: root, 
            _doctorId: req.session.doctorId, _doctorName: req.session.doctorName,
        _doctorPhone: req.session.doctorPhone});
    } 

    else if(req.params.state == 'fail') {
        res.render('loginFailed', {_root: root});
    } 

    else if(req.params.state == 'process') {
        DoctorModel.find({id: req.body.id}, (err, result) => {
            if(err) res.redirect('/login/fail');

            if(!result.length) return res.redirect('/login/fail');
            
            if(result[0].password == req.body.password) {
                 req.session.doctorId = result[0].id;
                 req.session.doctorName = result[0].name;
                 req.session.doctorPhone = result[0].phone;
                 res.redirect('/login/success');
             } 
             
             else {
                 return res.redirect('/login/fail');
             }
         });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if(err) console.log(err);
        res.redirect('/');
    });
});

app.get('/save', (req, res) => {
    res.render('save', {_root: root});
});

app.post('/save/patientinfo', (req, res) => {
    request({uri: 'http://107.108.58.102:3000/api/Patient/'+req.body.patientSSN}, (err, httpRes, body) => {
        if(httpRes.statusCode == '200') {
            PatientModel.find({id: req.body.patientSSN}, (err, result) => {
                if(err) res.redirect(root+ '/save');

                if(result.length == 0) return res.render('saveFailed');

                res.render('savePatientInfo', {_patientSSN: result[0].id,
                _patientName: result[0].name, _sex: result[0].sex,
                _birth: result[0].birth, _phone: result[0].phone
                 });
            });
        }
        else {
            res.render('saveFailed');
        }
    });
});

app.get('/save/failed', (req, res) => {
    res.render('saveFailed');
})

app.post('/save/request', upload.single('imageFile'), (req, res) => {
    var key = req.body.key;

    encryptor.encryptFile('medical_images/'+ req.file.originalname, 'medical_images/'+req.file.originalname+'.enc', key, (err) => {
        if(err) console.log(err);
        fs.unlink('medical_images/'+req.file.originalname, err => {
            if(err) console.log(err);

            console.log('file unlinked');
            fs.stat('medical_images/'+req.file.originalname+'.enc', (err, stats) => {
                var modifiedTime = stats.mtime;
        
                request.post(
                    { url: "http://107.108.58.102:3000/api/Save",
                            form: {
                                "$class": "org.example.mynetwork.Save",
                                "imageMetaData": {
                                  "$class": "org.example.mynetwork.ImageMetaData",
                                  "imageName": req.file.originalname+'.enc',
                                  "owner": "resource:org.example.mynetwork.Patient#"+req.body.patientSSN,
                                  "description": req.body.description,
                                  "size": req.file.size,
                                  "lastModifiedTime": modifiedTime,
                                  "provider": {
                                    "$class": "org.example.mynetwork.Doctor",
                                    "doctorId": req.session.doctorId,
                                    "doctorName": req.session.doctorName,
                                    "phone": req.session.doctorPhone
                                  },
                                  "expired": false
                                }
                              }
                     }, (err, httpRes, body) => {
                    switch(httpRes.statusCode) {
                        case 200:
                            res.redirect('/save');
                            break;
                        default:
                            res.redirect('/save/failed');
                            break;
                    }
                });
            });
        });
    });
});

app.get('/search', (req, res) => {
    res.render('search', {_root: root});
});

app.post('/search/request', (req, res) => {
    PatientModel.find({id: req.body.patientSSN}, (err, result) => {
        if(err) res.redirect(root+ '/search');

        if(result.length == 0) return res.render('searchFailed');

        request({uri: 'http://107.108.58.102:3000/api/Patient/'+req.body.patientSSN}, (err, httpRes, body) => {
            if(httpRes.statusCode == '200') {
                var queryResult = JSON.parse(body);
                res.render('searchResult', {_root: root, _patientSSN: result[0].id,
                    _patientName: result[0].name, _sex: result[0].sex,
                    _birth: result[0].birth, _phone: result[0].phone, _images: queryResult.images
                    });
            }
            else {
                res.redirect('/search');
            }
        });
    });
});

app.get('/download/:imagename', (req, res) => {
    var file = 'medical_images/' + req.params.imagename;
    var dfile = file.substring(0, file.length-4);
    fs.stat(file , (err, stats) => {
        if(err) console.log(err);

        var mtime = stats.mtime;
        var fileModifiedTime = mtime.getFullYear()+'/'+mtime.getMonth()+'/'+mtime.getDate()+' '+mtime.getHours()+':'+mtime.getMinutes()+':'+mtime.getSeconds();
        request({uri: 'http://107.108.58.102:3000/api/ImageMetaData/'+ req.params.imagename}, (err, httpRes, body) => {
            if(httpRes.statusCode == '200') {
                var queryFile = JSON.parse(body);
                console.log(queryFile.owner);
                request.post(
                    { url: "http://107.108.58.102:3000/api/Read",
                            form: {
                                "$class": "org.example.mynetwork.Read",
                                "patient": queryFile.owner,
                                "imageMetaData": "resource:org.example.mynetwork.ImageMetaData#"+req.params.imagename,
                                "downloader": "resource:org.example.mynetwork.Doctor#"+req.session.doctorId
                                }
                     }, (err, httpRes, body) => {
                    switch(httpRes.statusCode) {
                        case 200:
                            var queryFileTime = new Date(queryFile.lastModifiedTime);
                            var metadataModifiedTime = queryFileTime.getFullYear()+'/'+queryFileTime.getMonth()+'/'+queryFileTime.getDate()+' '+queryFileTime.getHours()+':'+queryFileTime.getMinutes()+':'+queryFileTime.getSeconds();
                            if(fileModifiedTime != metadataModifiedTime) {
                                res.render('filemodulateerror');
                            } else {
                                encryptor.decryptFile(file, dfile, req.query.key, (err) => {
                                    if(err) res.render('decryptionFailed');

                                    res.download(dfile, err => {
                                        if(err) console.log(err);
                                        
                                        fs.unlink(dfile, err => {   
                                            if(err) console.log(err);
                                    });
                                    });
                                });
                            }
                            break;
                        default:
                            res.send(httpRes.statusCode + httpRes.statusMessage);
                            break;
                    }
                });
            }
        });
    });
});


app.listen(4589, '127.0.0.1', () => {
    console.log('web server running on localhost:4589');
    connectDB();
});