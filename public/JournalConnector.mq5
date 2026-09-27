//+------------------------------------------------------------------+
//|                                            JournalConnector.mq5  |
//|     اتصال خودکار متاتریدر ۵ به ژورنال معاملاتی + اسکرین‌شات چارت |
//|                                                                  |
//|  نصب:                                                            |
//|  1) این فایل را در مسیر  MQL5\Experts  کپی و کامپایل کنید (F7)   |
//|  2) Tools > Options > Expert Advisors                            |
//|     «Allow WebRequest for listed URL» را فعال کنید و آدرس سایت   |
//|     خود را در لیست اضافه کنید (فقط ریشه دامنه)                   |
//|  3) اکسپرت را روی یک چارت بیندازید و ApiUrl/ApiToken را وارد کنید|
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "2.00"
#property description "ثبت خودکار معاملات (باز/بسته) + اسکرین‌شات خودکار چارت در ژورنال"
#property strict

input string InpApiUrl        = "https://YOUR-DOMAIN/api/mt5"; // آدرس وب‌هوک معاملات
input string InpShotUrl       = "";                            // آدرس آپلود تصویر (خالی = خودکار)
input string InpApiToken      = "tj_PASTE_YOUR_TOKEN";        // توکن API
input bool   InpSendOpen      = true;                          // ارسال معاملات باز
input bool   InpSendClose     = true;                          // ارسال معاملات بسته
input bool   InpEnableSync    = true;                          // همگام‌سازی خودکار تاریخچه
input int    InpSyncDays      = 14;                            // عمق همگام‌سازی (روز)
input int    InpTimerSeconds  = 30;                            // دوره همگام‌سازی (ثانیه)
input int    InpTimeoutMs     = 8000;                          // تایم‌اوت وب‌ریکوئست
input bool   InpDebug         = true;                          // چاپ لاگ در تب Experts

//--- تنظیمات اسکرین‌شات خودکار
input bool   InpScreenshots   = true;        // گرفتن اسکرین‌شات خودکار
input int    InpShotWidth     = 1600;        // عرض تصویر
input int    InpShotHeight    = 900;         // ارتفاع تصویر
input bool   InpShotOnlySymbolChart = true;  // فقط چارت همان نماد را عکاسی کن
input bool   InpDeleteAfterUpload   = true;  // حذف فایل بعد از آپلود موفق

int      g_failed   = 0;
datetime g_lastSync = 0;
string   g_shotUrl  = "";

//+------------------------------------------------------------------+
string JsonEscape(const string value)
  {
   string out = "";
   int    len = StringLen(value);
   for(int i = 0; i < len; i++)
     {
      string ch = StringSubstr(value, i, 1);
      if(ch == "\"")      out += "\\\"";
      else if(ch == "\\") out += "\\\\";
      else if(ch == "\n") out += "\\n";
      else if(ch == "\r") out += "\\r";
      else if(ch == "\t") out += "\\t";
      else                out += ch;
     }
   return out;
  }
//+------------------------------------------------------------------+
string Num(const double v, const int digits = -1)
  {
   if(digits < 0) return DoubleToString(v, 8);
   return DoubleToString(v, digits);
  }
//+------------------------------------------------------------------+
//| ساخت JSON یک دیل                                                 |
//+------------------------------------------------------------------+
string DealToJson(const ulong deal, const bool withBraces = true)
  {
   if(!HistoryDealSelect(deal))
      return "";

   ENUM_DEAL_TYPE dtype = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal, DEAL_TYPE);
   if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL)
      return "";

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
   string entryStr = "in";
   if(entry == DEAL_ENTRY_OUT)        entryStr = "out";
   else if(entry == DEAL_ENTRY_INOUT) entryStr = "inout";
   else if(entry == DEAL_ENTRY_OUT_BY) entryStr = "out_by";

   if(entry == DEAL_ENTRY_IN && !InpSendOpen)  return "";
   if(entry != DEAL_ENTRY_IN && !InpSendClose) return "";

   string symbol = HistoryDealGetString(deal, DEAL_SYMBOL);
   long   posId  = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
   double sl = 0, tp = 0;

   if(PositionSelectByTicket(posId))
     {
      sl = PositionGetDouble(POSITION_SL);
      tp = PositionGetDouble(POSITION_TP);
     }

   int    digits   = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double contract = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   if(contract <= 0) contract = 100000;

   string json = "";
   if(withBraces) json += "{";

   json += "\"ticket\":" + (string)deal + ",";
   json += "\"positionId\":" + (string)posId + ",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"type\":\"" + (dtype == DEAL_TYPE_BUY ? "buy" : "sell") + "\",";
   json += "\"entry\":\"" + entryStr + "\",";
   json += "\"volume\":" + Num(HistoryDealGetDouble(deal, DEAL_VOLUME)) + ",";
   json += "\"price\":" + Num(HistoryDealGetDouble(deal, DEAL_PRICE), digits) + ",";
   json += "\"profit\":" + Num(HistoryDealGetDouble(deal, DEAL_PROFIT), 2) + ",";
   json += "\"commission\":" + Num(HistoryDealGetDouble(deal, DEAL_COMMISSION), 2) + ",";
   json += "\"swap\":" + Num(HistoryDealGetDouble(deal, DEAL_SWAP), 2) + ",";
   json += "\"fee\":" + Num(HistoryDealGetDouble(deal, DEAL_FEE), 2) + ",";
   json += "\"time\":" + (string)(long)HistoryDealGetInteger(deal, DEAL_TIME) + ",";
   json += "\"sl\":" + Num(sl, digits) + ",";
   json += "\"tp\":" + Num(tp, digits) + ",";
   json += "\"digits\":" + (string)digits + ",";
   json += "\"contractSize\":" + Num(contract, 2) + ",";
   json += "\"comment\":\"" + JsonEscape(HistoryDealGetString(deal, DEAL_COMMENT)) + "\",";
   json += "\"magic\":" + (string)HistoryDealGetInteger(deal, DEAL_MAGIC) + ",";
   json += "\"accountLogin\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\",";
   json += "\"accountName\":\"" + JsonEscape(AccountInfoString(ACCOUNT_NAME)) + "\",";
   json += "\"accountServer\":\"" + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   json += "\"balance\":" + Num(AccountInfoDouble(ACCOUNT_BALANCE), 2);

   if(withBraces) json += "}";
   return json;
  }
//+------------------------------------------------------------------+
bool PostJson(const string url, const string payload)
  {
   if(StringLen(payload) == 0) return true;

   char   post[], result[];
   string resultHeaders = "";
   StringToCharArray(payload, post, 0, StringLen(payload));

   string headers = "Content-Type: application/json\r\n" +
                    "x-api-key: " + InpApiToken + "\r\n";

   ResetLastError();
   int status = WebRequest("POST", url, headers, InpTimeoutMs, post, result, resultHeaders);

   if(status == -1)
     {
      int err = GetLastError();
      if(err == 4014 || err == 4060)
         Print("JournalConnector: خطای 4014 -> آدرس ", url,
               " را در Tools > Options > Expert Advisors > Allow WebRequest اضافه کنید");
      else
         Print("JournalConnector: خطای WebRequest ", err);
      g_failed++;
      return false;
     }

   if(status < 200 || status >= 300)
     {
      Print("JournalConnector: پاسخ سرور ", status, " body=",
            CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8));
      g_failed++;
      return false;
     }

   g_failed = 0;
   if(InpDebug)
      Print("JournalConnector: OK ", status, " <- ", CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8));
   return true;
  }

bool PostJsonMain(const string payload) { return PostJson(InpApiUrl, payload); }

//+------------------------------------------------------------------+
//| گرفتن اسکرین‌شات چارت و برگرداندن نام فایل                       |
//+------------------------------------------------------------------+
string TakeScreenshot(const long chartId, const string tag)
  {
   if(!InpScreenshots) return "";

   string stamp = IntegerToString((long)TimeCurrent()) + "_" + IntegerToString((int)(GetTickCount() % 100000));
   string fname = tag + "_" + Symbol() + "_" + stamp + ".png";
   StringReplace(fname, ":", "-");
   StringReplace(fname, "/", "-");

   ResetLastError();
   if(!ChartScreenShot(chartId, fname, InpShotWidth, InpShotHeight, ALIGN_RIGHT))
     {
      Print("JournalConnector: خطا در گرفتن اسکرین‌شات ", GetLastError());
      return "";
     }

   // فایل ممکن است با کمی تاخیر نوشته شود
   for(int attempt = 0; attempt < 8; attempt++)
     {
      int h = FileOpen(fname, FILE_READ | FILE_BIN);
      if(h != INVALID_HANDLE)
        {
         FileClose(h);
         return fname;
        }
      Sleep(200);
     }

   Print("JournalConnector: فایل اسکرین‌شات پیدا نشد: ", fname);
   return "";
  }
//+------------------------------------------------------------------+
//| پیدا کردن چارت باز مربوط به یک نماد                              |
//+------------------------------------------------------------------+
long ChartForSymbol(const string symbol)
  {
   long own = ChartID();
   if(!InpShotOnlySymbolChart) return own;

   long first = ChartFirst();
   long cid   = first;
   for(int i = 0; i < 100 && cid >= 0; i++)
     {
      if(ChartSymbol(cid) == symbol)
         return cid;
      cid = ChartNext(cid);
      if(cid == first) break;
     }
   return own;
  }
//+------------------------------------------------------------------+
//| آپلود تصویر به صورت multipart/form-data                          |
//+------------------------------------------------------------------+
bool UploadScreenshot(const string fname, const string positionId, const string kind, const ulong dealTicket)
  {
   if(StringLen(fname) == 0) return false;
   if(StringLen(g_shotUrl) == 0) return false;

   int h = FileOpen(fname, FILE_READ | FILE_BIN);
   if(h == INVALID_HANDLE)
     {
      Print("JournalConnector: باز کردن فایل تصویر ممکن نشد: ", fname, " err=", GetLastError());
      return false;
     }

   int  size = (int)FileSize(h);
   char fileBytes[];
   ArrayResize(fileBytes, size);
   FileReadArray(h, fileBytes, 0, size);
   FileClose(h);

   if(size <= 0)
     {
      Print("JournalConnector: فایل تصویر خالی است: ", fname);
      return false;
     }

   string boundary = "----Journal" + IntegerToString((int)(GetTickCount() % 1000000)) +
                     IntegerToString((long)TimeCurrent());

   string head = "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"token\"\r\n\r\n" + InpApiToken + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"positionId\"\r\n\r\n" + positionId + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"kind\"\r\n\r\n" + kind + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"dealTicket\"\r\n\r\n" + (string)dealTicket + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"symbol\"\r\n\r\n" + Symbol() + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"width\"\r\n\r\n" + (string)InpShotWidth + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"height\"\r\n\r\n" + (string)InpShotHeight + "\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"source\"\r\n\r\nmt5\r\n" +
                 "--" + boundary + "\r\n" +
                 "Content-Disposition: form-data; name=\"file\"; filename=\"" + fname + "\"\r\n" +
                 "Content-Type: image/png\r\n\r\n";

   string tail = "\r\n--" + boundary + "--\r\n";

   char headBytes[], tailBytes[], body[];
   StringToCharArray(head, headBytes, 0, StringLen(head));
   StringToCharArray(tail, tailBytes, 0, StringLen(tail));

   int headLen = ArraySize(headBytes);
   int tailLen = ArraySize(tailBytes);
   ArrayResize(body, headLen + size + tailLen);

   int pos = 0;
   ArrayCopy(body, headBytes, pos, 0, headLen); pos += headLen;
   ArrayCopy(body, fileBytes, pos, 0, size);    pos += size;
   ArrayCopy(body, tailBytes, pos, 0, tailLen);

   string headers = "Content-Type: multipart/form-data; boundary=" + boundary + "\r\n" +
                    "x-api-key: " + InpApiToken + "\r\n";

   char   result[];
   string resultHeaders = "";
   ResetLastError();
   int status = WebRequest("POST", g_shotUrl, headers, InpTimeoutMs * 2, body, result, resultHeaders);

   if(status == -1)
     {
      Print("JournalConnector: خطای آپلود تصویر ", GetLastError());
      return false;
     }

   string resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   bool ok = (status >= 200 && status < 300);
   if(InpDebug)
      Print("JournalConnector: اسکرین‌شات ", kind, " status=", status, " resp=", resp);

   if(ok && InpDeleteAfterUpload)
      FileDelete(fname);

   return ok;
  }
//+------------------------------------------------------------------+
//| پردازش یک دیل: ارسال اطلاعات + اسکرین‌شات                        |
//+------------------------------------------------------------------+
void ProcessDeal(const ulong deal)
  {
   string json = DealToJson(deal);
   if(StringLen(json) == 0)
      return;

   bool sent = PostJsonMain(json);

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY);
   string kind = (entry == DEAL_ENTRY_IN) ? "open" : "close";

   if(InpScreenshots && sent)
     {
      long   posId = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
      string fname = TakeScreenshot(ChartForSymbol(HistoryDealGetString(deal, DEAL_SYMBOL)), kind);
      UploadScreenshot(fname, (string)posId, kind, deal);
     }
  }
//+------------------------------------------------------------------+
int OnInit()
  {
   if(StringFind(InpApiUrl, "YOUR-DOMAIN") >= 0)
      Print("JournalConnector: لطفاً آدرس وب‌هوک (InpApiUrl) را تنظیم کنید");

   g_shotUrl = InpShotUrl;
   if(StringLen(g_shotUrl) == 0)
     {
      g_shotUrl = InpApiUrl;
      StringReplace(g_shotUrl, "/api/mt5", "/api/screenshots");
     }

   MathSrand((int)GetTickCount());
   EventSetTimer(MathMax(5, InpTimerSeconds));
   Print("JournalConnector v2 started -> ", InpApiUrl, " | shots -> ", g_shotUrl);

   PostJsonMain("{\"mode\":\"test\",\"token\":\"" + InpApiToken + "\"}");
   if(InpEnableSync) SyncHistory(InpSyncDays);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }
//+------------------------------------------------------------------+
//| هر معامله جدید بلافاصله ارسال و عکاسی می‌شود                      |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest    &request,
                        const MqlTradeResult     &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   HistorySelect(TimeCurrent() - 86400, TimeCurrent() + 60);
   ProcessDeal(trans.deal);
  }
//+------------------------------------------------------------------+
//| همگام‌سازی تاریخچه (بدون اسکرین‌شات، چارت لحظه معامله نیست)       |
//+------------------------------------------------------------------+
void SyncHistory(const int days)
  {
   datetime from = TimeCurrent() - (datetime)(MathMax(1, days) * 86400);
   if(!HistorySelect(from, TimeCurrent() + 60))
      return;

   int    total   = HistoryDealsTotal();
   string payload = "";
   int    count   = 0;

   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;

      string json = DealToJson(deal, false);
      if(StringLen(json) == 0) continue;

      if(count > 0) payload += ",";
      payload += "{" + json + "}";
      count++;

      if(count >= 100)
        {
         PostJsonMain("{\"deals\":[" + payload + "]}");
         payload = "";
         count   = 0;
        }
     }

   if(count > 0)
      PostJsonMain("{\"deals\":[" + payload + "]}");

   g_lastSync = TimeCurrent();
   if(InpDebug) Print("JournalConnector: sync finished, deals=", total);
  }

void OnTimer()
  {
   if(!InpEnableSync) return;
   if(g_failed > 0 && TimeCurrent() - g_lastSync < 15) return;
   SyncHistory(InpSyncDays);
  }
//+------------------------------------------------------------------+
