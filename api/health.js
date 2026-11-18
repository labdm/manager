export default function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "text/plain");
  res.end("ok");
}
