# Multiple API Keys Support

## Overview
ORCA ab multiple API keys ko support karta hai dono providers ke liye - Groq aur OpenRouter. Agar ek key fail ho jaye (rate limit, auth error, etc.), toh automatically next key use hogi.

## Kaise Use Karein

### Format
API keys ko comma (`,`) se separate karke `.env` file mein add karo:

```env
# Single key (purana tarika - abhi bhi kaam karega)
GROQ_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# Multiple keys (naya tarika)
GROQ_API_KEY=key1,key2,key3
OPENROUTER_API_KEY=key1,key2,key3
```

### Example

```env
# Groq ke multiple keys
GROQ_API_KEY=gsk_abc123def456,gsk_xyz789uvw012,gsk_mno345pqr678

# OpenRouter ke multiple keys
OPENROUTER_API_KEY=sk-or-v1-abc123,sk-or-v1-def456,sk-or-v1-ghi789
```

## Kaise Kaam Karta Hai

1. **Pehli Key Try Hoti Hai**: Request pehli key ke saath bhejta hai
2. **Agar Fail Ho**: 
   - Authentication error (401/403)
   - Rate limit error
   - Koi bhi retryable error
3. **Automatically Next Key**: System turant next available key try karega
4. **Retry Logic**: Har key ke liye configured retries bhi hongi

## Benefits

✅ **High Availability**: Ek key down ho toh dusri kaam karegi  
✅ **Rate Limit Management**: Multiple keys se zyada requests handle kar sakte ho  
✅ **Automatic Failover**: Manual intervention ki zarurat nahi  
✅ **Backward Compatible**: Single key wala purana format bhi kaam karega  

## Important Notes

⚠️ **Spaces**: Keys ke beech mein spaces mat dalo (sirf comma)  
⚠️ **Security**: `.env` file ko kabhi commit mat karo git mein  
⚠️ **Key Order**: Keys order mein try hongi (pehle pehli, phir dusri, etc.)  

## Error Handling

System automatically handle karega:
- Invalid keys ko skip karega
- Temporary errors pe retry karega
- Permanent errors pe next key try karega
- Sabhi keys fail hone pe proper error message dega

## Example Configuration

```env
# Complete example with multiple keys
OPENROUTER_API_KEY=sk-or-v1-primary,sk-or-v1-backup,sk-or-v1-emergency
GROQ_API_KEY=gsk_primary_key,gsk_backup_key,gsk_emergency_key

# Model IDs (already configured)
ORCA_INKLING_MODEL_ID=thinkingmachines/inkling
ORCA_QWEN36_MODEL_ID=qwen/qwen3.6-27b
ORCA_RESPONSE_MODEL_ID=qwen/qwen3.8-27b
ORCA_SYNTHESIS_MODEL_ID=openai/gpt-oss-120b
ORCA_FALLBACK_MODEL_ID=openai/gpt-oss-20b
```

## Testing

Apne keys test karne ke liye:
1. Pehli key deliberately invalid rakho
2. Application start karo
3. System automatically second key use karega
4. Logs mein dekh sakte ho ki konsi key use hui

---

**Made with ❤️ for ORCA Marine Intelligence Project**
