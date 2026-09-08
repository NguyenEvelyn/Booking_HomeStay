using HomestayAuth.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        // PostgreSQL folds unquoted identifiers to lowercase.
        user.ToTable("users");
        user.HasKey(x => x.Id);
        user.Property(x => x.Id).HasColumnName("user_id");
        user.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(100).IsRequired();
        user.Property(x => x.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
        user.HasIndex(x => x.Email).IsUnique();
        user.Property(x => x.PhoneNumber).HasColumnName("phone_number").HasMaxLength(20);
        user.HasIndex(x => x.PhoneNumber).IsUnique();
        user.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
        user.Property(x => x.Role).HasColumnName("role").HasMaxLength(20).HasDefaultValue("Customer").IsRequired();
        user.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("Active").IsRequired();
        user.Property(x => x.EmailVerificationCodeHash).HasColumnName("email_verification_code_hash").HasMaxLength(64);
        user.Property(x => x.EmailVerificationExpiresAt).HasColumnName("email_verification_expires_at");
        user.Property(x => x.EmailVerifiedAt).HasColumnName("email_verified_at");
        user.Property(x => x.FailedLoginAttempts).HasColumnName("failed_login_attempts").HasDefaultValue(0);
        user.Property(x => x.LockoutEnd).HasColumnName("lockout_end");
        user.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP");
        user.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}
