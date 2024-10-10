const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const midtransClient = require('midtrans-client'); // Midtrans Client SDK
const fetch = require('node-fetch'); // Pastikan kamu juga menginstal node-fetch

const app = express();
app.use(cors()); // Mengizinkan akses dari local frontend
app.use(bodyParser.json()); // Parsing JSON dari request body

// Endpoint untuk membuat link pembayaran Midtrans
app.post('/midtrans-payment', async (req, res) => {
    try {
        const { name, whatsapp, jumlah_orang, harga_total, tanggal_foto, jam_foto } = req.body;

        // Inisialisasi Midtrans API Client
        const snap = new midtransClient.Snap({
            isProduction: false, // Ganti ke true jika sudah production
            serverKey: 'SB-Mid-server-9cEe9pBpmC8XuB0zOw-A-Huq' // Ganti dengan Server Key dari akun Midtrans
        });

        // Membuat parameter transaksi
        const parameter = {
            transaction_details: {
                order_id: `order-${Date.now()}`,
                gross_amount: harga_total
            },
            customer_details: {
                first_name: name,
                email: `${whatsapp}@dummy.com`, // Midtrans butuh email, bisa buat dummy
                phone: whatsapp
            },
            item_details: [
                {
                    id: 'photo_booking',
                    price: 30000,
                    quantity: jumlah_orang,
                    name: `Booking foto ${tanggal_foto} ${jam_foto}`
                }
            ]
        };

        // Membuat transaksi ke Midtrans
        const transaction = await snap.createTransaction(parameter);

        // Mengembalikan link pembayaran ke frontend
        res.json({ redirect_url: transaction.redirect_url });
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Error creating payment' });
    }
});

// Endpoint untuk menerima notifikasi dari Midtrans
app.post('/midtrans-notification', async (req, res) => {
    try {
        const notification = req.body;

        // Cek status pembayaran
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;

        if (transactionStatus === 'settlement') {
            // Ambil data dari notification untuk disimpan ke Google Spreadsheet
            const name = notification.customer_details.first_name;
            const whatsapp = notification.customer_details.phone;
            const jumlah_orang = notification.item_details[0].quantity;
            const tanggal_foto = notification.item_details[0].name.split(' ')[2]; // Ambil tanggal
            const jam_foto = notification.item_details[0].name.split(' ')[3]; // Ambil jam
            const harga_total = notification.gross_amount;

            // Kirim data ke Google Spreadsheet
            const response = await sendDataToSpreadsheet(name, whatsapp, jumlah_orang, tanggal_foto, jam_foto, harga_total);

            if (response.result === 'success') {
                res.status(200).json({ message: 'Data berhasil disimpan' });
            } else {
                res.status(500).json({ error: 'Gagal menyimpan data' });
            }
        } else {
            res.status(200).json({ message: 'Status pembayaran tidak memerlukan tindakan' });
        }
    } catch (error) {
        console.error('Error processing notification:', error);
        res.status(500).json({ error: 'Error processing notification' });
    }
});

// Fungsi untuk mengirim data ke Google Spreadsheet
const sendDataToSpreadsheet = async (name, whatsapp, jumlah_orang, tanggal_foto, jam_foto, harga_total) => {
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbwS6q0JN7X_0v4w_P6PgvRTuLDxILi-XS2l-j9xW8hXKu0xiTy9vLZHrR6BBpalz3Kxng/exec'; // Ganti dengan URL Google Apps Script kamu

    const response = await fetch(scriptUrl, {
        method: 'POST',
        body: JSON.stringify({
            name: name,
            whatsapp: whatsapp,
            jumlah_orang: jumlah_orang,
            tanggal_foto: tanggal_foto,
            jam_foto: jam_foto,
            harga_total: harga_total
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return response.json();
};
const response = await sendDataToSpreadsheet(name, whatsapp, jumlah_orang, tanggal_foto, jam_foto, harga_total);
console.log('Response from Spreadsheet:', response);

app.listen(3000, () => {
    console.log('Backend server running on port 3000');
});
