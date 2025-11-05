const databaseService = require('./databaseService');

class AuthService {
  generatePassword() {
    const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'GOLDPRO_';
    for (let i = 0; i < 8; i++) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
  }

  async authenticateUser(password, telegramId) {
    try {
      console.log(`🔐 Authenticating user: ${telegramId}`);
      
      const user = await databaseService.findUserByPassword(password);
      
      if (!user) {
        return { success: false, message: '❌ Invalid access code' };
      }

      if (user.status !== 'active') {
        return { success: false, message: '❌ Subscription inactive or expired' };
      }

      // Check if password is already used by another Telegram account
      if (user.telegramId && user.telegramId !== telegramId.toString()) {
        return { success: false, message: '❌ Access code already activated on another account' };
      }

      // If this is first activation, update the user
      if (!user.telegramId) {
        const updateSuccess = await databaseService.updateUserTelegramId(user.id, telegramId.toString());
        
        if (!updateSuccess) {
          return { success: false, message: '❌ System error during activation' };
        }

        // Update user object with new data
        user.telegramId = telegramId.toString();
        user.activatedAt = new Date().toISOString();
        user.lastActive = new Date().toISOString();
        
        console.log(`✅ New user activated: ${user.id} for Telegram: ${telegramId}`);
      } else {
        // Update last active for existing user
        await databaseService.updateUserLastActive(user.id);
        user.lastActive = new Date().toISOString();
      }

      return { 
        success: true, 
        user: user,
        message: '✅ Authentication successful! Welcome to GoldAI Mentor Pro!'
      };

    } catch (error) {
      console.error('❌ Authentication error:', error);
      return { success: false, message: '❌ System error during authentication' };
    }
  }

  async createUser(planType = 'premium') {
    try {
      const password = this.generatePassword();
      
      const userData = {
        password: password,
        plan: planType.toLowerCase(),
        status: 'active',
        telegramId: null,
        createdAt: new Date().toISOString(),
        activatedAt: null,
        lastActive: null,
        expiresAt: this.calculateExpiryDate(30) // 30 days default
      };

      const user = await databaseService.createUser(userData);
      
      if (!user) {
        return { success: false, message: '❌ Failed to create user in database' };
      }

      return {
        success: true,
        userId: user.id,
        password: password,
        plan: planType,
        user: user,
        message: `✅ ${planType} user created successfully!`
      };

    } catch (error) {
      console.error('❌ Error creating user:', error);
      return { success: false, message: '❌ Failed to create user: ' + error.message };
    }
  }

  async validateUserAccess(telegramId) {
    try {
      const user = await databaseService.findUserByTelegramId(telegramId);
      
      if (!user) {
        return { valid: false, message: '❌ Please activate your subscription with /start YOUR_CODE' };
      }

      if (user.status !== 'active') {
        return { valid: false, message: '❌ Your subscription is inactive or expired' };
      }

      // Check if subscription expired
      if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
        return { valid: false, message: '❌ Your subscription has expired' };
      }

      // Update last active timestamp
      await databaseService.updateUserLastActive(user.id);

      return { valid: true, user: user };

    } catch (error) {
      console.error('❌ User validation error:', error);
      return { valid: false, message: '❌ System error during validation' };
    }
  }

  calculateExpiryDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  // Admin function to extend subscription
  async extendSubscription(userId, additionalDays) {
    try {
      const user = await databaseService.findUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      let newExpiry;
      if (user.expiresAt && new Date(user.expiresAt) > new Date()) {
        // Extend from current expiry
        newExpiry = new Date(user.expiresAt);
        newExpiry.setDate(newExpiry.getDate() + additionalDays);
      } else {
        // Extend from today
        newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + additionalDays);
      }

      const success = await databaseService.updateUser(userId, {
        expiresAt: newExpiry.toISOString(),
        status: 'active'
      });

      if (success) {
        return { 
          success: true, 
          message: `✅ Subscription extended by ${additionalDays} days`,
          newExpiry: newExpiry.toISOString()
        };
      } else {
        return { success: false, message: '❌ Failed to extend subscription' };
      }

    } catch (error) {
      console.error('❌ Extend subscription error:', error);
      return { success: false, message: '❌ System error' };
    }
  }
}

module.exports = new AuthService();