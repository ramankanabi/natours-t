const dotenv = require("dotenv");
const mongoose = require("mongoose");
const app = require("./app");
dotenv.config({ path: "./config.env" });

const db = process.env.DATABASE.replace("<password>", "fjEvKmmqKQ3E8Srt");
mongoose
  .connect(db, {
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
  })
  .then((con) => {
    // console.log(con.connections);
    console.log("DB connection succefully");
  });





const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("the server listennnnnnn");
});
