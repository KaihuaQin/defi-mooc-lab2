// littleRound 2021 Oct 28
// To use this server for batched testing
// 1. run `ALCHE_API="https://eth-mainnet.alchemyapi.io/v2/<update with yours>" npm run defi-lab2-serve`
// 2. send the files to be tested via `curl -i http://localhost:8888/submit -F "contract_file=@/path/to/file" -F "email=<submission_email_address>"`
// or
// 2. open http://localhost:8888/ and use the UI for submisstion

const fs = require('fs');
const { execSync } = require('child_process');

const Koa = require('koa');
const Router = require('koa-router')
const koaBody = require('koa-body')({multipart:true, uploadDir: '.'});

const app = new Koa();

fs.mkdir('./uploads', { recursive: true }, (err) => {});

// scorer

TARGET_FILE = './contracts/LiquidationOperator.sol';
PROTECTED_LOC = './contracts/LiquidationOperator.sol.original';

function get_score(path) {
  ret = {};
  try {
    // prepare env
    // 1. make sure profit.txt is gone
    try {
      fs.unlinkSync('./profit.txt');
    } catch (e) {}
    // 2. make sure the std contract is protected
    try {
      fs.renameSync(TARGET_FILE, PROTECTED_LOC);
    } catch (e) {console.log(e)}

    // run the test
    // 1. copy the contract to the target
    fs.copyFileSync(`./uploads/${path}`, TARGET_FILE);
    // 2. run the test
    try { 
      output = execSync('npm test');
    } catch (e) {
      console.log(e);
      throw "Compilation or assertion failed.";
    }
    ret['exec_output'] = output.toString();
    // 3. get the score
    eth_amount = parseFloat(fs.readFileSync('./profit.txt'));
    ret['eth_amount'] = eth_amount;
    ret['status'] = 'done';
    ret['score'] = 0;
    if (eth_amount < 21) {
      ret['score'] = 6;
    } else if (eth_amount < 24) {
      ret['score'] = 12;
    } else if (eth_amount < 30) {
      ret['score'] = 13;
    } else if (eth_amount < 43) {
      ret['score'] = 14;
    } else if (eth_amount >= 43) {
      ret['score'] = 15;
    } else {
      // something went wrong, eth_amount is NaN
    }
  } catch (e) {
    ret['status'] = 'err';
    ret['err_message'] = e;
  }
  // recover the scene
  try {
    fs.renameSync(PROTECTED_LOC, TARGET_FILE);
  } catch (e) {}
  return ret;
}

// logger

app.use((ctx, next) => {
  const start = new Date;
  return next().then(() => {
    const ms = new Date - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}`);
  });
});

// response

const router = new Router()

router.get('/', (ctx) => {
    ctx.body = `
    <html>
    <h1>Submit your contract here</h1> 
    <p> It should be in <u>.sol</u> format</p>
    <p> (Testing might take up to 30 seconds, please be patient.) </p>
    <br>
    <form action="/submit" method="post" enctype="multipart/form-data" target="_blank">
        <input type="email" name="email" placeholder="Your email @berkeley.edu">
        <br>
        <input type="file" id="contract_file" name="contract_file" accept=".sol">
        <br>
        <input type="submit" value="Submit">
    </form>
    </html>
    `;
});

router.post('/submit', koaBody, (ctx) => {
  try {
    const {path, name, type} = ctx.request.files.contract_file;
    email = ctx.request.body.email;
    filename = `${email},${new Date().toISOString()}.sol`.replace(/:/g, '-');
    fs.copyFileSync(path, `./uploads/${filename}`, fs.constants.COPYFILE_EXCL);
    body = {"status": "uploaded", "uploaded": true, "score": 0};
    result = get_score(filename);
    Object.keys(result).forEach(key => body[key] = result[key]);
    fs.writeFileSync(`./uploads/${filename}.result.json`, JSON.stringify(body, null, 4));
    ctx.body = body;
  } catch(err) {
    console.log(`error ${err.message}`);
    ctx.throw(500, err.message);
  }
});

app.use(router.routes());

const port = process.env.PORT || 8888;
app.listen(port);
console.log('Koa server start listening to port %s', port);
console.log('Try:\n\tcurl -i http://localhost:%s/submit -F "email=your@email.com" -F "contract_file=@/path/to/file.png"', port);
