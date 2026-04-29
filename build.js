const fs = require('fs');
const path = require('path');

console.log('正在构建配置文件...');

// 尝试从 .env 文件读取（本地开发使用）
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
} catch (e) {
  console.log('未找到 .env 文件，使用环境变量');
}

const templatePath = path.join(__dirname, 'js', 'config.js.template');
const outputPath = path.join(__dirname, 'js', 'config.js');

let template = fs.readFileSync(templatePath, 'utf8');

template = template.replace(/\${SUPABASE_URL}/g, process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co');
template = template.replace(/\${SUPABASE_ANON_KEY}/g, process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key');

fs.writeFileSync(outputPath, template, 'utf8');

console.log('✅ config.js 构建完成！');
