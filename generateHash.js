const bcrypt = require("bcrypt");

bcrypt.hash("200320Bk?", 10)
    .then(hash => {
        console.log("Generated Hash:");
        console.log(hash);
    })
    .catch(err => {
        console.error(err);
    });