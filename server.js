const express = require("express");
const app = express();
const mongoose = require("mongoose");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
app.use(session({
    secret: "swordfish",
    resave: false,
    saveUninitialized: true,
    // cookie: {maxAge: 60000}
}));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
mongoose.connect("mongodb://localhost/dojo_secrets");
var CommentSchema = new mongoose.Schema({
    comment: {type: String, required: true}
});
var SecretSchema = new mongoose.Schema({
    secret: {type: String, required: true},
    comments: [CommentSchema]
});
var UserSchema = new mongoose.Schema({
    email: {type: String, required: true, unique: true},
        // match: [/\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]+)\z/, 'Please fill a valid email address']},
    first_name: {type: String, required: true},
    last_name: {type: String, required: true},
    password: {type: String, required: true},
    birthday: {type: Date, required: true},
    secrets: [SecretSchema]
});
mongoose.model("User", UserSchema);
var User = mongoose.model("User");
app.get("/", function(req, res){
    res.render("index");
});
app.get("/secrets", function(req, res){
    if(req.session.user_id) {
        User.findOne({_id: req.session.user_id}, function(err, user){
            if(err) {
                res.redirect("/");
            }
            else {
                User.find({}, function(err, users){
                    if(err) {
                        res.redirect("/");
                    }
                    else {
                        res.render("secrets", {users: users, user: user});
                    }
                });
            }
        });
    }
    else {
        res.redirect("/");
    }
});
app.get("/secrets/:id", function(req, res){
    if(req.session.user_id) {
        User.findOne({_id: req.session.user_id}, function(err, user){
            if(err) {
                res.redirect("/");
            }
            else {
                User.findOne({secrets: {$elemMatch: {_id: req.params.id}}}, function(err, secret_user){
                    if(err) {
                        res.redirect("/secrets");
                    }
                    else {
                        var secret = secret_user.secrets.id(req.params.id);
                        res.render("secret", {secret: secret});
                    }
                });
            }
        });
    }
    else {
        res.redirect("/");
    }
});
app.post("/users", function(req, res){
    var user = new User();
    var user_fields = ["email", "first_name", "last_name", "birthday"];
    for(var i=0; i<user_fields.length; i++) {
        user[user_fields[i]] = req.body[user_fields[i]];
        console.log("user[user_fields[i]]: ", user[user_fields[i]])
    }
    user.secrets = [];
    bcrypt.hash(req.body.password, 10, function(err, hash){
        if(err) {
            res.redirect("/");
        }
        else {
            user.password = hash;
            user.save(function(err){
                if(err) {
                    console.log(err);
                    res.redirect("/");
                }
                else {
                    req.session.user_id = user._id;
                    console.log("user: ", user);
                    res.redirect("/secrets");
                }
            });
        }
    });
});
app.post("/sessions", function(req, res){
    User.findOne({email: req.body.email}, function(err, user){
        if(err) {
            res.redirect("/");
        }
        else {
            console.log("found user with email " + user.email);
            bcrypt.compare(req.body.password, user.password, function(err, result){
                if(result) {
                    req.session.user_id = user._id;
                    res.redirect("/secrets");
                }
                else {
                    res.redirect("/");
                }
            });
        }
    });
});
app.post("/secrets", function(req, res){
    if(req.session.user_id) {
        User.findOne({_id: req.session.user_id}, function(err, user){
            if(err) {
                res.redirect("/");
            }
            else {
                user.secrets.push({secret: req.body.secret, comments: []});
                user.save(function(err){
                    res.redirect("/secrets");
                });
            }
        });
    }
    else {
        res.redirect("/");
    }
});
app.post("/secrets/:id/comments", function(req, res){
    if(req.session.user_id) {
        User.findOne({_id: req.session.user_id}, function(err, user){
            if(err) {
                res.redirect("/");
            }
            else {
                User.findOne({secrets: {$elemMatch: {_id: req.params.id}}}, function(err, secret_user){
                    if(err) {
                        res.redirect("/secrets");
                    }
                    else {
                        // console.log("secret_user.secrets", secret_user.secrets);
                        for(var i = 0; i < secret_user.secrets.length; i++){
                            if(secret_user.secrets[i]._id == req.params.id){
                                var secret = secret_user.secrets[i];
                            }
                        }

                        // var secret = secret_user.secrets.id(req.params.id); i couldt find any info on .id() but it works
                        // console.log("actual secret: ", secret);
                        secret.comments.push({comment: req.body.comment});
                        secret_user.save(function(err){
                            res.redirect("/secrets/" + secret._id);
                        });
                    }
                });
            }
        });
    }
    else {
        res.redirect("/");
    }
});
app.get("/secrets/:id/delete", function(req, res){
    if(req.session.user_id) {
        User.findOne({_id: req.session.user_id}, function(err, user){
            if(err) {
                res.redirect("/");
            }
            else {
                User.findOne({secrets: {$elemMatch: {_id: req.params.id}}}, function(err, secret_user){
                    if(err) {
                        res.redirect("/secrets");
                    }
                    else {
                        console.log("secret_user.secrets.id(req.params.id)", secret_user.secrets.id(req.params.id))
                        for(let j = 0; j<secret_user.secrets.length; j++){
                            if(secret_user.secrets[j]._id == req.params.id){
                                console.log("deleting at:", j);
                                secret_user.secrets.splice(j, 1);
                            }
                        }
                        // secret_user.secrets.id(req.params.id).remove(); //still works but i dont know how exactly
                        secret_user.save(function(err){
                            res.redirect("/secrets");
                        });
                    }
                });
            }
        });
    }
    else {
        res.redirect("/");
    }
});
app.get("/logout", function(req, res){
    if(req.session.user_id) {
        delete req.session.user_id;
    }
    res.redirect("/");
})
app.listen(8000);