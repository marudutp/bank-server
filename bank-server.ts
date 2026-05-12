import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();


const allowedOrigins = [
    "https://campus3d-delta.vercel.app",
    "http://localhost:5173",
    "http://localhost:5000"
];
// ============================================
// MIDDLEWARE
// ============================================
// app.use(cors({ origin: "*", credentials: true }));
app.use(cors({
    origin: (origin, callback) => {

        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("❌ BLOCKED BANK ORIGIN:", origin);
            callback(new Error("Not allowed by CORS"));
        }

    },

    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE (Dummy)
// ============================================

// User balances
interface Balance {
    userId: string;
    amount: number;
    currency: string;
    lastUpdated: Date;
}

const balances = new Map<string, Balance>();

// Transactions
interface Transaction {
    id: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    type: string;
    status: string;
    timestamp: Date;
    description?: string;
}

const transactions: Transaction[] = [];

// Initialize demo data
const initDemoData = () => {
    // Teacher demo accounts
    balances.set('teacher_demo', {
        userId: 'teacher_demo',
        amount: 5000000,
        currency: 'IDR',
        lastUpdated: new Date()
    });
    balances.set('admin_001', {
        userId: 'admin_001',
        amount: 10000000,
        currency: 'IDR',
        lastUpdated: new Date()
    });

    // Student demo accounts
    for (let i = 1; i <= 10; i++) {
        balances.set(`student_demo_${i}`, {
            userId: `student_demo_${i}`,
            amount: 1000000,
            currency: 'IDR',
            lastUpdated: new Date()
        });
    }
};

initDemoData();

// ============================================
// ROUTES
// ============================================
app.get('/', (req, res) => {
    res.send('💰 BANK SERVER IS LIVE!');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        totalAccounts: balances.size,
        totalTransactions: transactions.length,
        uptime: process.uptime()
    });
});

// ============================================
// BALANCE APIs
// ============================================

// Get balance by user ID
app.get('/balance/:userId', (req, res) => {
    const { userId } = req.params;
    const balance = balances.get(userId);

    if (!balance) {
        // Return 0 for new users
        return res.json({
            userId,
            balance: 0,
            currency: 'IDR'
        });
    }

    res.json({
        userId: balance.userId,
        balance: balance.amount,
        currency: balance.currency,
        lastUpdated: balance.lastUpdated
    });
});

// Get all balances (admin only - for debugging)
app.get('/balances', (req, res) => {
    const allBalances = Array.from(balances.values());
    res.json(allBalances);
});

// ============================================
// PAYMENT APIs
// ============================================

// Process payment
app.post('/pay', async (req, res) => {
    try {
        const { studentId, teacherId, amount, description } = req.body;

        console.log(`💰 Payment request: ${studentId} -> ${teacherId} = ${amount}`);

        // Validasi input
        if (!studentId || !teacherId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: studentId, teacherId, amount'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be greater than 0'
            });
        }

        // Get balances (create if not exist)
        let studentBalance = balances.get(studentId);
        let teacherBalance = balances.get(teacherId);

        if (!studentBalance) {
            studentBalance = {
                userId: studentId,
                amount: 0,
                currency: 'IDR',
                lastUpdated: new Date()
            };
            balances.set(studentId, studentBalance);
        }

        if (!teacherBalance) {
            teacherBalance = {
                userId: teacherId,
                amount: 0,
                currency: 'IDR',
                lastUpdated: new Date()
            };
            balances.set(teacherId, teacherBalance);
        }

        // Check if student has sufficient balance
        if (studentBalance.amount < amount) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance',
                currentBalance: studentBalance.amount,
                required: amount
            });
        }

        // Process transaction
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Deduct from student
        studentBalance.amount -= amount;
        studentBalance.lastUpdated = new Date();

        // Add to teacher
        teacherBalance.amount += amount;
        teacherBalance.lastUpdated = new Date();

        // Record transaction
        const transaction: Transaction = {
            id: transactionId,
            fromUserId: studentId,
            toUserId: teacherId,
            amount: amount,
            type: 'payment',
            status: 'completed',
            timestamp: new Date(),
            description: description || 'Class payment'
        };
        transactions.push(transaction);

        console.log(`✅ Payment completed: ${transactionId} - ${amount} from ${studentId} to ${teacherId}`);

        res.json({
            success: true,
            transactionId: transactionId,
            amount: amount,
            from: studentId,
            to: teacherId,
            newBalance: studentBalance.amount,
            timestamp: transaction.timestamp
        });

    } catch (error) {
        console.error('❌ Payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================
// REFUND APIs
// ============================================

// Process refund
app.post('/refund', async (req, res) => {
    try {
        const { studentIds, teacherId, amount, description } = req.body;

        console.log(`💰 Refund request: ${teacherId} -> ${studentIds.length} students = ${amount * studentIds.length}`);

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'studentIds must be a non-empty array'
            });
        }

        if (!teacherId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: teacherId, amount'
            });
        }

        const totalRefund = amount * studentIds.length;
        const teacherBalance = balances.get(teacherId);

        if (!teacherBalance || teacherBalance.amount < totalRefund) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient teacher balance for refund',
                teacherBalance: teacherBalance?.amount || 0,
                required: totalRefund
            });
        }

        // Deduct from teacher
        teacherBalance.amount -= totalRefund;
        teacherBalance.lastUpdated = new Date();

        const refundTransactions: any[] = [];

        // Add to each student
        for (const studentId of studentIds) {
            let studentBalance = balances.get(studentId);
            if (!studentBalance) {
                studentBalance = {
                    userId: studentId,
                    amount: 0,
                    currency: 'IDR',
                    lastUpdated: new Date()
                };
                balances.set(studentId, studentBalance);
            }

            studentBalance.amount += amount;
            studentBalance.lastUpdated = new Date();

            // Record transaction
            const transactionId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const transaction: Transaction = {
                id: transactionId,
                fromUserId: teacherId,
                toUserId: studentId,
                amount: amount,
                type: 'refund',
                status: 'completed',
                timestamp: new Date(),
                description: description || 'Class cancellation refund'
            };
            transactions.push(transaction);
            refundTransactions.push(transaction);
        }

        console.log(`✅ Refund completed: Total ${totalRefund} to ${studentIds.length} students`);

        res.json({
            success: true,
            totalRefund: totalRefund,
            studentsCount: studentIds.length,
            transactions: refundTransactions,
            teacherNewBalance: teacherBalance.amount
        });

    } catch (error) {
        console.error('❌ Refund error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================
// TRANSACTION APIs
// ============================================

// Get transaction history for a user
app.get('/transactions/:userId', (req, res) => {
    const { userId } = req.params;

    const userTransactions = transactions.filter(t =>
        t.fromUserId === userId || t.toUserId === userId
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({
        userId,
        transactions: userTransactions
    });
});

// Get all transactions (admin)
app.get('/transactions', (req, res) => {
    res.json(transactions);
});

// Get transaction by ID
app.get('/transaction/:id', (req, res) => {
    const { id } = req.params;
    const transaction = transactions.find(t => t.id === id);

    if (!transaction) {
        return res.status(404).json({
            success: false,
            error: 'Transaction not found'
        });
    }

    res.json(transaction);
});

// ============================================
// ADMIN APIs
// ============================================

// Add balance (for testing)
app.post('/admin/add-balance', (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
        return res.status(400).json({
            success: false,
            error: 'Missing userId or amount'
        });
    }

    let userBalance = balances.get(userId);
    if (!userBalance) {
        userBalance = {
            userId: userId,
            amount: 0,
            currency: 'IDR',
            lastUpdated: new Date()
        };
        balances.set(userId, userBalance);
    }

    userBalance.amount += amount;
    userBalance.lastUpdated = new Date();

    res.json({
        success: true,
        userId,
        newBalance: userBalance.amount
    });
});

// Reset database (for testing)
app.post('/admin/reset', (req, res) => {
    balances.clear();
    transactions.length = 0;
    initDemoData();

    res.json({
        success: true,
        message: 'Database reset to initial state'
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
    console.log("=".repeat(50));
    console.log("💰 BANK SERVER ONLINE");
    console.log(`📡 Port: ${PORT}`);
    console.log("=".repeat(50));
});