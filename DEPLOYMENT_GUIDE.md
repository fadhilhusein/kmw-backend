# KMW Backend - Security Audit & Deployment Guide

## 🚨 SECURITY AUDIT REPORT

### 🔴 CRITICAL ISSUES (Must Fix Before Production)

1. **Exposed Credentials in .env**
   - Database credentials are visible in plain text
   - JWT_SECRET is exposed and potentially weak
   - Midtrans server key is exposed
   - **Solution**: Generate new secrets and use Render environment variables

2. **Weak JWT Fallback Secrets**
   - Multiple files use "rahasia_negara_api" as fallback secret
   - Files affected: `authController.js`, `authMiddleware.js`
   - **Solution**: Remove fallbacks or use throw error if missing

3. **Security Vulnerabilities in Dependencies**
   - 4 High-severity vulnerabilities found:
     - axios (DoS vulnerability)
     - minimatch (ReDoS vulnerabilities)
     - picomatch (ReDoS vulnerabilities)
     - qs (DoS vulnerability)
   - **Solution**: Run `npm audit fix`

4. **Rate Limiting Disabled**
   - All rate limiters are commented out in `authRoutes.js`
   - Files affected: `authRoutes.js` lines 18, 24, 30
   - **Solution**: Enable rate limiting for production

5. **Weak Activation Code Generation**
   - Only 2 random bytes (4 hex chars) for activation codes
   - **Solution**: Increase to at least 4-6 random bytes

### 🟡 MEDIUM ISSUES (Should Fix)

1. **Error Messages Expose Implementation Details**
   - `error.getMessage() + "AA"` in authController
   - Console.error in authMiddleware
   - **Solution**: Use generic error messages in production

2. **No package-lock.json**
   - Dependencies aren't pinned, could cause version drift
   - **Solution**: Run `npm install` to generate lock file

3. **Development Environment Configuration**
   - `NODE_ENV=development` should be `production`
   - `FRONTEND_URL=http://localhost:3000` should be production URL
   - **Solution**: Update environment variables

### 🟢 POSITIVE SECURITY FEATURES

✅ Helmet security headers enabled
✅ CORS with whitelist
✅ Input sanitization middleware
✅ Bcrypt password hashing
✅ JWT token expiration
✅ Comprehensive error handling
✅ Health check endpoints
✅ Request logging and monitoring
✅ Prisma ORM (SQL injection protection)
✅ .env in .gitignore

## 📋 PRE-DEPLOYMENT CHECKLIST

### Security Fixes
- [ ] Generate new strong JWT_SECRET (32+ characters)
- [ ] Update all credentials for production
- [ ] Run `npm audit fix` to patch vulnerabilities
- [ ] Enable rate limiting in authRoutes.js
- [ ] Remove or secure JWT fallback secrets
- [ ] Test all authentication flows
- [ ] Verify CORS whitelist for production domains
- [ ] Review error messages for information disclosure

### Environment Setup
- [ ] Create production database in Render/Supabase
- [ ] Generate environment variables for Render
- [ ] Update FRONTEND_URL to production domain
- [ ] Set NODE_ENV=production
- [ ] Configure Midtrans production credentials
- [ ] Test database migrations

### Code Configuration
- [ ] Update index.js PORT to 5000 (or use environment variable)
- [ ] Review and test all API endpoints
- [ ] Ensure file logging is disabled in production
- [ ] Configure proper logging levels
- [ ] Test health check endpoints

### Deployment Prep
- [ ] Push code to GitHub repository
- [ ] Create Render account
- [ ] Connect Render to GitHub
- [ ] Test build process locally
- [ ] Create deployment documentation
- [ ] Setup monitoring and alerting

## 🚀 RENDER DEPLOYMENT STEPS

### 1. Prepare Your Code
```bash
# Fix security vulnerabilities
npm audit fix

# Generate package-lock.json if missing
npm install

# Test production build locally
NODE_ENV=production node index.js
```

### 2. Create Render Account
- Sign up at [render.com](https://render.com)
- Verify email
- Connect GitHub account

### 3. Setup Database
Option A: Use Render PostgreSQL
- Create new PostgreSQL service in Render
- Get connection string for DATABASE_URL and DIRECT_URL

Option B: Use Existing Supabase
- Use current Supabase database
- Update connection strings in environment variables

### 4. Deploy Backend
1. Click "New+" in Render dashboard
2. Select "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: kmw-backend
   - **Region**: Singapore (closest to Indonesia)
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### 5. Configure Environment Variables
Add these in Render dashboard:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=your-production-database-url
DIRECT_URL=your-direct-database-url
JWT_SECRET=your-generated-secret-key-here
FRONTEND_URL=https://your-frontend-url.vercel.app
MIDTRANS_SERVER_KEY=your-midtrans-production-key
LOG_LEVEL=info
LOG_FILE_ENABLED=false
LOG_CONSOLE_ENABLED=true
ENABLE_MONITORING=true
ENABLE_HEALTH_CHECK=true
```

### 6. Generate Secure Secrets

Generate a strong JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7. Deploy and Test
- Click "Create Web Service"
- Wait for deployment (~2-5 minutes)
- Test health check: `https://your-app.onrender.com/health`
- Test API endpoints
- Check logs in Render dashboard

## 🔍 POST-DEPLOYMENT VERIFICATION

### Health Checks
```bash
# Test server is running
curl https://your-app.onrender.com/health

# Test root endpoint
curl https://your-app.onrender.com/

# Test database connection
curl https://your-app.onrender.com/api/monitoring/health
```

### Security Tests
```bash
# Test CORS is working
curl -H "Origin: https://your-frontend-url.vercel.app" \
     https://your-app.onrender.com/api/auth/login

# Test rate limiting (if enabled)
for i in {1..10}; do
  curl https://your-app.onrender.com/api/auth/login
done

# Test authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app.onrender.com/api/auth/me
```

### Monitoring
- Check Render logs for errors
- Monitor response times
- Track database performance
- Set up alerts for failures

## 🛠️ MAINTENANCE

### Regular Tasks
- Update dependencies monthly: `npm update`
- Check security: `npm audit`
- Monitor logs daily
- Backup database regularly
- Review access logs

### Updates
```bash
# Pull latest code
git pull origin main

# Update dependencies
npm update

# Check for security issues
npm audit
npm audit fix

# Deploy (auto-deploy should handle this)
```

## 💰 COST ESTIMATION (Render)

**Free Tier (Development):**
- Web Service: $0/month
- PostgreSQL: $7/month
- **Total: $7/month**

**Paid Tier (Production):**
- Starter Web Service: $7/month
- Starter PostgreSQL: $20/month
- **Total: $27/month**

**For campus organization:** Start with free tier, upgrade as needed.

## 📞 TROUBLESHOOTING

### Common Issues

**Build Fails:**
- Check package.json scripts
- Ensure all dependencies are listed
- Review build logs in Render

**Database Connection Errors:**
- Verify DATABASE_URL format
- Check Supabase/Render database status
- Test connection string locally

**Authentication Fails:**
- Verify JWT_SECRET matches between environments
- Check token expiration
- Review CORS configuration

**Performance Issues:**
- Enable database indexing
- Implement caching
- Review query performance
- Consider upgrading Render plan

## 📚 ADDITIONAL RESOURCES

- [Render Documentation](https://render.com/docs)
- [Node.js Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [JWT Best Practices](https://jwt.io/introduction)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment)

---

**Last Updated:** 2026-03-26
**Security Status:** ⚠️ Issues found, fix required before production deployment