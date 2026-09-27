//+------------------------------------------------------------------+
//|                                            JournalConnector.mq4  |
//|        اتصال خودکار متاتریدر ۴ به ژورنال معاملاتی              |
//|                                                                  |
//|  نصب:                                                            |
//|  1) فایل را در مسیر  MQL4\Experts  کپی و کامپایل کنید           |
//|  2) Tools > Options > Expert Advisors > Allow WebRequest         |
//|     آدرس سایت را در لیست URLها اضافه کنید                        |
//|  3) اکسپرت را روی یک چارت بیندازید                               |
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "2.00"
#property description "ثبت خودکار معاملات MT4 + اسکرین‌شات چارت در ژورنال"
#property strict

input string InpApiUrl        = "https://YOUR-DOMAIN/api/mt5"; // آدرس وب‌هوک
input string InpShotUrl       = "";                            // آدرس آپلود تصویر (خالی = خودکار)
input string InpApiToken      = "tj_PASTE_YOUR_TOKEN";        // توکن API
input int    InpTimerSeconds  = 20;                            // دوره بررسی (ثانیه)
input int    InpTimeoutMs     = 8000;
input bool   InpDebug         = true;
input bool   InpScreenshots   = true;        // اسکرین‌شات خودکار
input int    InpShotWidth     = 1366;
input int    InpShotHeight    = 768;
input bool   InpDeleteAfterUpload = true;

string g_seen[];
string g_shotUrl = "";

//+------------------------------------------------------------------+
string JsonEscape(const string value)
  {
   string out = "";
   for(int i = 0; i < StringLen(value); i++)
     {
      string ch = StringSubstr(value, i, 1);
      if(ch == "\"")      out += "\\\"";
      else if(ch == "\\") out += "\\\\";
      else if(ch == "\n") out += "\\n";
      else                out += ch;
     }
   return out;
  }

bool Seen(const string key)
  {
   for(int i = 0; i < ArraySize(g_seen); i++)
      if(g_seen[i] == key) return true;
   return false;
  }

void Mark(const string key)
  {
   int size = ArraySize(g_seen);
   ArrayResize(g_seen, size + 1);
   g_seen[size] = key;
  }

//+------------------------------------------------------------------+
bool PostJson(const string payload)
  {
   char post[], result[];
   string resultHeaders = "";
   StringToCharArray(payload, post, 0, StringLen(payload));
   string headers = "Content-Type: application/json\r\nx-api-key: " + InpApiToken + "\r\n";

   ResetLastError();
   int status = WebRequest("POST", InpApiUrl, headers, InpTimeoutMs, post, result, resultHeaders);
   if(status < 200 || status >= 300)
     {
      Print("JournalConnector: WebRequest خطا ", GetLastError(), " status=", status);
      return false;
     }
   if(InpDebug) Print("JournalConnector: OK ", status);
   return true;
  }

//+------------------------------------------------------------------+
void SendOpen(const int ticket)
  {
   string key = "O" + (string)ticket + "-" + (string)OrderStopLoss() + "-" + (string)OrderTakeProfit();
   if(Seen(key)) return;

   string json = "{";
   json += "\"ticket\":\"" + key + "\",";
   json += "\"positionId\":\"" + (string)ticket + "\",";
   json += "\"symbol\":\"" + OrderSymbol() + "\",";
   json += "\"type\":\"" + (OrderType() == OP_BUY ? "buy" : "sell") + "\",";
   json += "\"entry\":\"in\",";
   json += "\"volume\":" + DoubleToString(OrderLots(), 2) + ",";
   json += "\"price\":" + DoubleToString(OrderOpenPrice(), Digits) + ",";
   json += "\"profit\":0,";
   json += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
   json += "\"swap\":0,";
   json += "\"time\":" + (string)(int)OrderOpenTime() + ",";
   json += "\"sl\":" + DoubleToString(OrderStopLoss(), Digits) + ",";
   json += "\"tp\":" + DoubleToString(OrderTakeProfit(), Digits) + ",";
   json += "\"digits\":" + (string)Digits + ",";
   json += "\"comment\":\"" + JsonEscape(OrderComment()) + "\",";
   json += "\"accountLogin\":\"" + (string)AccountNumber() + "\",";
   json += "\"accountName\":\"" + JsonEscape(AccountName()) + "\",";
   json += "\"accountServer\":\"" + JsonEscape(AccountServer()) + "\"";
   json += "}";

   if(PostJson(json))
     {
      Mark(key);
      if(InpScreenshots)
        {
         string shot = TakeScreenshot("open");
         UploadScreenshot(shot, (string)ticket, "open", (string)ticket);
        }
     }
  }

//+------------------------------------------------------------------+
void SendClose(const int ticket)
  {
   string key = "C" + (string)ticket;
   if(Seen(key)) return;

   string json = "{";
   json += "\"ticket\":\"" + key + "\",";
   json += "\"positionId\":\"" + (string)ticket + "\",";
   json += "\"symbol\":\"" + OrderSymbol() + "\",";
   json += "\"type\":\"" + (OrderType() == OP_BUY ? "buy" : "sell") + "\",";
   json += "\"entry\":\"out\",";
   json += "\"volume\":" + DoubleToString(OrderLots(), 2) + ",";
   json += "\"price\":" + DoubleToString(OrderClosePrice(), Digits) + ",";
   json += "\"profit\":" + DoubleToString(OrderProfit(), 2) + ",";
   json += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
   json += "\"swap\":" + DoubleToString(OrderSwap(), 2) + ",";
   json += "\"time\":" + (string)(int)OrderCloseTime() + ",";
   json += "\"sl\":" + DoubleToString(OrderStopLoss(), Digits) + ",";
   json += "\"tp\":" + DoubleToString(OrderTakeProfit(), Digits) + ",";
   json += "\"digits\":" + (string)Digits + ",";
   json += "\"comment\":\"" + JsonEscape(OrderComment()) + "\",";
   json += "\"accountLogin\":\"" + (string)AccountNumber() + "\",";
   json += "\"accountName\":\"" + JsonEscape(AccountName()) + "\",";
   json += "\"accountServer\":\"" + JsonEscape(AccountServer()) + "\"";
   json += "}";

   if(PostJson(json)) Mark(key);
  }


//+------------------------------------------------------------------+
//| اسکرین‌شات چارت + آپلود multipart                                |
//+------------------------------------------------------------------+
string TakeScreenshot(const string tag)
  {
   if(!InpScreenshots) return "";
   string stamp = TimeToStr(TimeCurrent(), TIME_DATE|TIME_SECONDS);
   StringReplace(stamp, ":", "-");
   StringReplace(stamp, ".", "-");
   StringReplace(stamp, " ", "_");
   string fname = tag + "_" + Symbol() + "_" + stamp + ".png";
   if(!WindowScreenShot(fname, InpShotWidth, InpShotHeight))
     {
      Print("JournalConnector: خطای اسکرین‌شات ", GetLastError());
      return "";
     }
   for(int tries = 0; tries < 8; tries++)
     {
      int probe = FileOpen(fname, FILE_READ|FILE_BIN);
      if(probe != INVALID_HANDLE) { FileClose(probe); return fname; }
      Sleep(200);
     }
   return "";
  }

bool UploadScreenshot(const string fname, const string positionId, const string kind, const string ticket)
  {
   if(StringLen(fname) == 0 || StringLen(g_shotUrl) == 0) return false;

   int h = FileOpen(fname, FILE_READ|FILE_BIN);
   if(h == INVALID_HANDLE) return false;
   int size = FileSize(h);
   char fileBytes[];
   ArrayResize(fileBytes, size);
   FileReadArray(h, fileBytes, 0, size);
   FileClose(h);
   if(size <= 0) return false;

   string boundary = "----Journal" + IntegerToString(GetTickCount());
   string head = "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"token\"\r\n\r\n" + InpApiToken + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"positionId\"\r\n\r\n" + positionId + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"kind\"\r\n\r\n" + kind + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"dealTicket\"\r\n\r\n" + ticket + "-" + kind + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"symbol\"\r\n\r\n" + Symbol() + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"source\"\r\n\r\nmt4\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"file\"; filename=\"" + fname + "\"\r\n" +
                 "Content-Type: image/png\r\n\r\n";
   string tail = "\r\n--" + boundary + "--\r\n";

   char headBytes[], tailBytes[], body[];
   StringToCharArray(head, headBytes, 0, StringLen(head));
   StringToCharArray(tail, tailBytes, 0, StringLen(tail));
   int headLen = ArraySize(headBytes), tailLen = ArraySize(tailBytes);
   ArrayResize(body, headLen + size + tailLen);
   ArrayCopy(body, headBytes, 0, 0, headLen);
   ArrayCopy(body, fileBytes, headLen, 0, size);
   ArrayCopy(body, tailBytes, headLen + size, 0, tailLen);

   char result[];
   string rh = "";
   string headers = "Content-Type: multipart/form-data; boundary=" + boundary + "\r\n" +
                    "x-api-key: " + InpApiToken + "\r\n";
   int status = WebRequest("POST", g_shotUrl, headers, InpTimeoutMs * 2, body, result, rh);
   bool ok = (status >= 200 && status < 300);
   if(InpDebug) Print("JournalConnector: shot ", kind, " status=", status);
   if(ok && InpDeleteAfterUpload) FileDelete(fname);
   return ok;
  }
//+------------------------------------------------------------------+
int OnInit()
  {
   g_shotUrl = InpShotUrl;
   if(StringLen(g_shotUrl) == 0)
     {
      g_shotUrl = InpApiUrl;
      StringReplace(g_shotUrl, "/api/mt5", "/api/screenshots");
     }

   EventSetTimer(MathMax(5, InpTimerSeconds));
   PostJson("{\"mode\":\"test\",\"token\":\"" + InpApiToken + "\"}");
   Scan();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick()  { Scan(); }
void OnTimer() { Scan(); }

//+------------------------------------------------------------------+
void Scan()
  {
   for(int i = 0; i < OrdersTotal(); i++)
     {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() != OP_BUY && OrderType() != OP_SELL) continue;
      SendOpen(OrderTicket());
     }

   for(int j = 0; j < OrdersHistoryTotal(); j++)
     {
      if(!OrderSelect(j, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderType() != OP_BUY && OrderType() != OP_SELL) continue;
      if(OrderCloseTime() == 0) continue;
      SendClose(OrderTicket());
     }
  }
//+------------------------------------------------------------------+
