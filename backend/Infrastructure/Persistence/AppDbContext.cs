using HomestayAuth.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.ToTable("Users");
        user.HasKey(x => x.Id);
        user.Property(x => x.Id).HasColumnName("user_id");
        user.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(100).IsRequired();
        user.Property(x => x.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
        user.HasIndex(x => x.Email).IsUnique();
        user.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255).IsRequired();
        user.Property(x => x.Role).HasColumnName("role").HasMaxLength(20).HasDefaultValue("Customer").IsRequired();
        user.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("SYSUTCDATETIME()");
        user.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("SYSUTCDATETIME()");
    }
}
